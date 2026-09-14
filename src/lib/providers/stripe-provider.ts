import Stripe from 'stripe';

export interface TelemetryData {
  value: number;
  currency: string;
  quality: 'VERIFIED' | 'INSUFFICIENT_EVIDENCE' | 'UNAVAILABLE';
  errorDetail?: string;
}

export class StripeTelemetryProvider {
  private stripe: Stripe;

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-06-20' as any, // Using as any to bypass strict type check for stripe version
      typescript: true,
    });
  }

  /**
   * Tests if the credentials are valid and we can reach Stripe.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.stripe.balance.retrieve();
      return true;
    } catch (err) {
      console.error('Stripe provider testConnection failed:', err);
      return false;
    }
  }

  /**
   * Calculates REVENUE_MTD deterministically.
   * Definition: Sum of all successful 'charge' amounts within the current calendar month.
   * Currency handling: Only aggregates 'usd' charges. If multiple currencies are found,
   * we only sum the USD ones (or we could reject, but summing USD is deterministic).
   */
  async calculateRevenueMTD(targetCurrency: string = 'usd'): Promise<TelemetryData> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const startTimestamp = Math.floor(startOfMonth.getTime() / 1000);
      const endTimestamp = Math.floor(now.getTime() / 1000);

      let hasMore = true;
      let lastObjectId: string | undefined = undefined;
      
      let totalRevenueCents = 0;
      let nonTargetCurrencyDetected = false;
      let chargeCount = 0;

      while (hasMore) {
        const charges = await this.stripe.charges.list({
          created: {
            gte: startTimestamp,
            lte: endTimestamp,
          },
          limit: 100,
          starting_after: lastObjectId,
        });

        for (const charge of charges.data) {
          if (charge.status === 'succeeded' && charge.paid) {
            // Subtract refunded amount from the total
            const netAmount = charge.amount - charge.amount_refunded;
            
            if (charge.currency.toLowerCase() === targetCurrency.toLowerCase()) {
              totalRevenueCents += netAmount;
              chargeCount++;
            } else {
              nonTargetCurrencyDetected = true;
            }
          }
        }

        if (charges.has_more) {
          lastObjectId = charges.data[charges.data.length - 1].id;
        } else {
          hasMore = false;
        }
      }

      if (chargeCount === 0 && !nonTargetCurrencyDetected) {
        // Technically this might just be $0 revenue, but if we have no evidence, it's safer
        // to return the actual value of 0, it is verified.
        return {
          value: 0,
          currency: targetCurrency,
          quality: 'VERIFIED'
        };
      }

      return {
        value: totalRevenueCents / 100, // Convert cents to dollars
        currency: targetCurrency,
        quality: 'VERIFIED',
      };

    } catch (err: any) {
      console.error('StripeProvider.calculateRevenueMTD Error:', err);
      return {
        value: 0,
        currency: targetCurrency,
        quality: 'UNAVAILABLE',
        errorDetail: err.message
      };
    }
  }

  /**
   * Calculates REVENUE_LAST_MONTH deterministically.
   * Useful for derived growth calculations.
   */
  async calculateRevenueLastMonth(targetCurrency: string = 'usd'): Promise<TelemetryData> {
    try {
      const now = new Date();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      
      const startTimestamp = Math.floor(startOfLastMonth.getTime() / 1000);
      const endTimestamp = Math.floor(endOfLastMonth.getTime() / 1000);

      let hasMore = true;
      let lastObjectId: string | undefined = undefined;
      
      let totalRevenueCents = 0;
      let nonTargetCurrencyDetected = false;
      let chargeCount = 0;

      while (hasMore) {
        const charges = await this.stripe.charges.list({
          created: {
            gte: startTimestamp,
            lte: endTimestamp,
          },
          limit: 100,
          starting_after: lastObjectId,
        });

        for (const charge of charges.data) {
          if (charge.status === 'succeeded' && charge.paid) {
            const netAmount = charge.amount - charge.amount_refunded;
            
            if (charge.currency.toLowerCase() === targetCurrency.toLowerCase()) {
              totalRevenueCents += netAmount;
              chargeCount++;
            } else {
              nonTargetCurrencyDetected = true;
            }
          }
        }

        if (charges.has_more) {
          lastObjectId = charges.data[charges.data.length - 1].id;
        } else {
          hasMore = false;
        }
      }

      if (chargeCount === 0 && !nonTargetCurrencyDetected) {
        return {
          value: 0,
          currency: targetCurrency,
          quality: 'VERIFIED'
        };
      }

      return {
        value: totalRevenueCents / 100,
        currency: targetCurrency,
        quality: 'VERIFIED',
      };

    } catch (err: any) {
      console.error('StripeProvider.calculateRevenueLastMonth Error:', err);
      return {
        value: 0,
        currency: targetCurrency,
        quality: 'UNAVAILABLE',
        errorDetail: err.message
      };
    }
  }

  /**
   * Calculates TRANSACTIONS_MTD deterministically.
   */
  async calculateTransactionsMTD(): Promise<TelemetryData> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startTimestamp = Math.floor(startOfMonth.getTime() / 1000);
      
      let hasMore = true;
      let lastObjectId: string | undefined = undefined;
      let chargeCount = 0;

      while (hasMore) {
        const charges = await this.stripe.charges.list({
          created: { gte: startTimestamp },
          limit: 100,
          starting_after: lastObjectId,
        });

        for (const charge of charges.data) {
          if (charge.status === 'succeeded' && charge.paid) {
            chargeCount++;
          }
        }
        if (charges.has_more) {
          lastObjectId = charges.data[charges.data.length - 1].id;
        } else {
          hasMore = false;
        }
      }

      return { value: chargeCount, currency: 'COUNT', quality: 'VERIFIED' };
    } catch (err: any) {
      console.error('StripeProvider.calculateTransactionsMTD Error:', err);
      return { value: 0, currency: 'COUNT', quality: 'UNAVAILABLE', errorDetail: err.message };
    }
  }

  /**
   * Calculates NEW_CUSTOMERS_MTD deterministically.
   */
  async calculateNewCustomersMTD(): Promise<TelemetryData> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startTimestamp = Math.floor(startOfMonth.getTime() / 1000);
      
      let hasMore = true;
      let lastObjectId: string | undefined = undefined;
      let count = 0;

      while (hasMore) {
        const customers = await this.stripe.customers.list({
          created: { gte: startTimestamp },
          limit: 100,
          starting_after: lastObjectId,
        });

        count += customers.data.length;
        
        if (customers.has_more) {
          lastObjectId = customers.data[customers.data.length - 1].id;
        } else {
          hasMore = false;
        }
      }

      return { value: count, currency: 'COUNT', quality: 'VERIFIED' };
    } catch (err: any) {
      console.error('StripeProvider.calculateNewCustomersMTD Error:', err);
      return { value: 0, currency: 'COUNT', quality: 'UNAVAILABLE', errorDetail: err.message };
    }
  }

  /**
   * Calculates ACTIVE_SUBSCRIPTIONS deterministically.
   */
  async calculateActiveSubscriptions(): Promise<TelemetryData> {
    try {
      let hasMore = true;
      let lastObjectId: string | undefined = undefined;
      let count = 0;

      while (hasMore) {
        const subscriptions = await this.stripe.subscriptions.list({
          status: 'active',
          limit: 100,
          starting_after: lastObjectId,
        });

        count += subscriptions.data.length;
        
        if (subscriptions.has_more) {
          lastObjectId = subscriptions.data[subscriptions.data.length - 1].id;
        } else {
          hasMore = false;
        }
      }

      return { value: count, currency: 'COUNT', quality: 'VERIFIED' };
    } catch (err: any) {
      console.error('StripeProvider.calculateActiveSubscriptions Error:', err);
      return { value: 0, currency: 'COUNT', quality: 'UNAVAILABLE', errorDetail: err.message };
    }
  }
}
