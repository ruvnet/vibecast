/**
 * Data resources for the MCP server
 */
import { McpResource } from '../types';

/**
 * Reference data resource for countries
 */
export const countriesResource: McpResource = {
  uri: 'data/countries',
  description: 'Reference data for countries',
  handler: async () => {
    // This is a simplified list of countries for demonstration purposes
    return {
      count: 10,
      data: [
        {
          code: 'US',
          name: 'United States',
          capital: 'Washington, D.C.',
          region: 'Americas',
          subregion: 'Northern America',
          population: 331002651,
          languages: ['English'],
          currencies: [{ code: 'USD', name: 'United States dollar', symbol: '$' }],
          timezones: ['UTC-12:00', 'UTC-11:00', 'UTC-10:00', 'UTC-09:00', 'UTC-08:00', 'UTC-07:00', 'UTC-06:00', 'UTC-05:00', 'UTC-04:00', 'UTC+10:00', 'UTC+12:00']
        },
        {
          code: 'CA',
          name: 'Canada',
          capital: 'Ottawa',
          region: 'Americas',
          subregion: 'Northern America',
          population: 37742154,
          languages: ['English', 'French'],
          currencies: [{ code: 'CAD', name: 'Canadian dollar', symbol: '$' }],
          timezones: ['UTC-08:00', 'UTC-07:00', 'UTC-06:00', 'UTC-05:00', 'UTC-04:00', 'UTC-03:30']
        },
        {
          code: 'GB',
          name: 'United Kingdom',
          capital: 'London',
          region: 'Europe',
          subregion: 'Northern Europe',
          population: 67886011,
          languages: ['English'],
          currencies: [{ code: 'GBP', name: 'British pound', symbol: '£' }],
          timezones: ['UTC-08:00', 'UTC-05:00', 'UTC-04:00', 'UTC-03:00', 'UTC-02:00', 'UTC', 'UTC+01:00', 'UTC+02:00', 'UTC+06:00']
        },
        {
          code: 'DE',
          name: 'Germany',
          capital: 'Berlin',
          region: 'Europe',
          subregion: 'Western Europe',
          population: 83783942,
          languages: ['German'],
          currencies: [{ code: 'EUR', name: 'Euro', symbol: '€' }],
          timezones: ['UTC+01:00']
        },
        {
          code: 'FR',
          name: 'France',
          capital: 'Paris',
          region: 'Europe',
          subregion: 'Western Europe',
          population: 65273511,
          languages: ['French'],
          currencies: [{ code: 'EUR', name: 'Euro', symbol: '€' }],
          timezones: ['UTC-10:00', 'UTC-09:30', 'UTC-09:00', 'UTC-08:00', 'UTC-04:00', 'UTC-03:00', 'UTC+01:00', 'UTC+02:00', 'UTC+03:00', 'UTC+04:00', 'UTC+05:00', 'UTC+10:00', 'UTC+11:00', 'UTC+12:00']
        },
        {
          code: 'JP',
          name: 'Japan',
          capital: 'Tokyo',
          region: 'Asia',
          subregion: 'Eastern Asia',
          population: 126476461,
          languages: ['Japanese'],
          currencies: [{ code: 'JPY', name: 'Japanese yen', symbol: '¥' }],
          timezones: ['UTC+09:00']
        },
        {
          code: 'CN',
          name: 'China',
          capital: 'Beijing',
          region: 'Asia',
          subregion: 'Eastern Asia',
          population: 1402112000,
          languages: ['Chinese'],
          currencies: [{ code: 'CNY', name: 'Chinese yuan', symbol: '¥' }],
          timezones: ['UTC+08:00']
        },
        {
          code: 'IN',
          name: 'India',
          capital: 'New Delhi',
          region: 'Asia',
          subregion: 'Southern Asia',
          population: 1380004385,
          languages: ['Hindi', 'English'],
          currencies: [{ code: 'INR', name: 'Indian rupee', symbol: '₹' }],
          timezones: ['UTC+05:30']
        },
        {
          code: 'BR',
          name: 'Brazil',
          capital: 'Brasília',
          region: 'Americas',
          subregion: 'South America',
          population: 212559417,
          languages: ['Portuguese'],
          currencies: [{ code: 'BRL', name: 'Brazilian real', symbol: 'R$' }],
          timezones: ['UTC-05:00', 'UTC-04:00', 'UTC-03:00', 'UTC-02:00']
        },
        {
          code: 'AU',
          name: 'Australia',
          capital: 'Canberra',
          region: 'Oceania',
          subregion: 'Australia and New Zealand',
          population: 25499884,
          languages: ['English'],
          currencies: [{ code: 'AUD', name: 'Australian dollar', symbol: '$' }],
          timezones: ['UTC+05:00', 'UTC+06:30', 'UTC+07:00', 'UTC+08:00', 'UTC+09:30', 'UTC+10:00', 'UTC+10:30', 'UTC+11:00']
        }
      ],
      metadata: {
        source: 'Mock data for demonstration purposes',
        updated: new Date().toISOString()
      }
    };
  },
};

/**
 * Reference data resource for currencies
 */
export const currenciesResource: McpResource = {
  uri: 'data/currencies',
  description: 'Reference data for currencies',
  handler: async () => {
    // This is a simplified list of currencies for demonstration purposes
    return {
      count: 10,
      data: [
        {
          code: 'USD',
          name: 'United States dollar',
          symbol: '$',
          countries: ['US', 'EC', 'SV', 'MH', 'FM', 'PA', 'TL'],
          decimal_digits: 2
        },
        {
          code: 'EUR',
          name: 'Euro',
          symbol: '€',
          countries: ['AD', 'AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'MC', 'ME', 'NL', 'PT', 'SM', 'SK', 'SI', 'ES', 'VA'],
          decimal_digits: 2
        },
        {
          code: 'JPY',
          name: 'Japanese yen',
          symbol: '¥',
          countries: ['JP'],
          decimal_digits: 0
        },
        {
          code: 'GBP',
          name: 'British pound',
          symbol: '£',
          countries: ['GB', 'IO', 'GG', 'IM', 'JE'],
          decimal_digits: 2
        },
        {
          code: 'AUD',
          name: 'Australian dollar',
          symbol: '$',
          countries: ['AU', 'CX', 'CC', 'HM', 'KI', 'NR', 'NF', 'TV'],
          decimal_digits: 2
        },
        {
          code: 'CAD',
          name: 'Canadian dollar',
          symbol: '$',
          countries: ['CA'],
          decimal_digits: 2
        },
        {
          code: 'CHF',
          name: 'Swiss franc',
          symbol: 'Fr',
          countries: ['CH', 'LI'],
          decimal_digits: 2
        },
        {
          code: 'CNY',
          name: 'Chinese yuan',
          symbol: '¥',
          countries: ['CN'],
          decimal_digits: 2
        },
        {
          code: 'INR',
          name: 'Indian rupee',
          symbol: '₹',
          countries: ['IN', 'BT'],
          decimal_digits: 2
        },
        {
          code: 'BRL',
          name: 'Brazilian real',
          symbol: 'R$',
          countries: ['BR'],
          decimal_digits: 2
        }
      ],
      metadata: {
        source: 'Mock data for demonstration purposes',
        updated: new Date().toISOString()
      }
    };
  },
};

/**
 * Reference data resource for time zones
 */
export const timeZonesResource: McpResource = {
  uri: 'data/timezones',
  description: 'Reference data for time zones',
  handler: async () => {
    // This is a simplified list of time zones for demonstration purposes
    return {
      count: 10,
      data: [
        {
          id: 'UTC',
          display_name: 'Coordinated Universal Time',
          offset: '+00:00',
          dst: false,
          countries: ['GB', 'IE', 'IS', 'PT']
        },
        {
          id: 'America/New_York',
          display_name: 'Eastern Time',
          offset: '-05:00',
          dst: true,
          dst_offset: '-04:00',
          countries: ['US', 'CA']
        },
        {
          id: 'America/Chicago',
          display_name: 'Central Time',
          offset: '-06:00',
          dst: true,
          dst_offset: '-05:00',
          countries: ['US', 'CA', 'MX']
        },
        {
          id: 'America/Denver',
          display_name: 'Mountain Time',
          offset: '-07:00',
          dst: true,
          dst_offset: '-06:00',
          countries: ['US', 'CA', 'MX']
        },
        {
          id: 'America/Los_Angeles',
          display_name: 'Pacific Time',
          offset: '-08:00',
          dst: true,
          dst_offset: '-07:00',
          countries: ['US', 'CA']
        },
        {
          id: 'Europe/London',
          display_name: 'British Time',
          offset: '+00:00',
          dst: true,
          dst_offset: '+01:00',
          countries: ['GB']
        },
        {
          id: 'Europe/Paris',
          display_name: 'Central European Time',
          offset: '+01:00',
          dst: true,
          dst_offset: '+02:00',
          countries: ['FR', 'DE', 'IT', 'ES', 'NL', 'BE']
        },
        {
          id: 'Asia/Tokyo',
          display_name: 'Japan Standard Time',
          offset: '+09:00',
          dst: false,
          countries: ['JP']
        },
        {
          id: 'Australia/Sydney',
          display_name: 'Australian Eastern Time',
          offset: '+10:00',
          dst: true,
          dst_offset: '+11:00',
          countries: ['AU']
        },
        {
          id: 'Pacific/Auckland',
          display_name: 'New Zealand Time',
          offset: '+12:00',
          dst: true,
          dst_offset: '+13:00',
          countries: ['NZ']
        }
      ],
      current_time: {
        utc: new Date().toISOString(),
        timestamp: Math.floor(Date.now() / 1000)
      },
      metadata: {
        source: 'Mock data for demonstration purposes',
        updated: new Date().toISOString()
      }
    };
  },
};

/**
 * Sample dataset resource for demonstration
 */
export const sampleDatasetResource: McpResource = {
  uri: 'data/sample_dataset',
  description: 'Sample dataset for demonstration and testing',
  handler: async () => {
    // Generate a sample dataset with random values
    const generateSampleData = () => {
      const data = [];
      const startDate = new Date('2025-01-01');
      const categories = ['Category A', 'Category B', 'Category C'];
      const regions = ['North', 'South', 'East', 'West'];
      
      for (let i = 0; i < 100; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        data.push({
          id: i + 1,
          date: date.toISOString().split('T')[0],
          category: categories[Math.floor(Math.random() * categories.length)],
          region: regions[Math.floor(Math.random() * regions.length)],
          value: Math.round(Math.random() * 1000) / 10,
          quantity: Math.floor(Math.random() * 100),
          is_active: Math.random() > 0.2
        });
      }
      
      return data;
    };
    
    const sampleData = generateSampleData();
    
    // Calculate some basic statistics
    const calculateStats = (data: any[]) => {
      const totalValue = data.reduce((sum, item) => sum + item.value, 0);
      const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0);
      const avgValue = totalValue / data.length;
      const avgQuantity = totalQuantity / data.length;
      
      // Group by category
      const categoryStats: Record<string, any> = {};
      data.forEach(item => {
        if (!categoryStats[item.category]) {
          categoryStats[item.category] = {
            count: 0,
            total_value: 0,
            total_quantity: 0
          };
        }
        
        categoryStats[item.category].count++;
        categoryStats[item.category].total_value += item.value;
        categoryStats[item.category].total_quantity += item.quantity;
      });
      
      // Calculate averages for each category
      Object.keys(categoryStats).forEach(category => {
        categoryStats[category].avg_value = categoryStats[category].total_value / categoryStats[category].count;
        categoryStats[category].avg_quantity = categoryStats[category].total_quantity / categoryStats[category].count;
      });
      
      return {
        count: data.length,
        total_value: totalValue,
        total_quantity: totalQuantity,
        avg_value: avgValue,
        avg_quantity: avgQuantity,
        by_category: categoryStats
      };
    };
    
    return {
      name: 'Sample Dataset',
      description: 'A randomly generated dataset for demonstration purposes',
      rows: sampleData.length,
      columns: Object.keys(sampleData[0]).length,
      column_names: Object.keys(sampleData[0]),
      data: sampleData,
      statistics: calculateStats(sampleData),
      metadata: {
        generated: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  },
};