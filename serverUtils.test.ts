import { describe, it, expect } from 'vitest';
import { 
  parseSupportedDate, 
  withThaiDateVariants, 
  buildFineFeeItems 
} from './serverUtils';

describe('Date Parsing and Normalization Tests', () => {
  it('should parse YYYY-MM correctly into a Date object (first day of month)', () => {
    const result = parseSupportedDate('2026-04');
    expect(result).not.toBeNull();
    if (result) {
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(3); // 0-indexed, so 3 is April
      expect(result.getDate()).toBe(1);
    }
  });

  it('should format missing date variants as empty strings recursively', () => {
    const testData = {
      nested: {
        someDate: 'invalid-date-format', // will fail parsing
        otherField: 'hello'
      }
    };
    
    // Test implicitly through the normalizer wrapper
    const result = withThaiDateVariants(testData);
    
    expect(result.nested.someDate_thdate_full).toBe('');
    expect(result.nested.someDate_thmonth_full).toBe('');
  });

  it('should populate TH date variants when valid date is provided', () => {
    const testData = {
      op_OverdueBillStart: '2026-04' // April 2026
    };
    
    const result = withThaiDateVariants(testData);
    
    // 2026 + 543 = 2569
    expect(result.op_OverdueBillStart_thmonth_full).toBe('เมษายน 2569');
    expect(result.op_OverdueBillStart_thmonth_short).toBe('เม.ย. 2569');
  });
});

describe('Legacy Array Projection Tests', () => {
  it('should lift first item of op_details into root fields for backwards compatibility', () => {
    const testData = {
      op_details: [
        {
          op_ReferenceNumber: 'OP-123',
          op_customerName: 'John Doe',
          op_OverdueBillStart: '2020-01',
          op_amount: '500'
        }
      ]
    };

    const result = withThaiDateVariants(testData);
    
    expect(result.op_ReferenceNumber).toBe('OP-123');
    expect(result.op_customerName).toBe('John Doe');
    expect(result.op_amount).toBe('500');
    // Also ensures it processes the lifted field for Thai dates
    expect(result.op_OverdueBillStart_thmonth_full).toBe('มกราคม 2563'); 
  });
});

describe('Fine Fee Items Calculation', () => {
  it('should build fee items combining base fine amount with additional fees', () => {
    const testData = {
      fn_amount: '1000',
      fn_additionalFees: [
        { name: 'Late penalty', amount: '50' }
      ]
    };

    const result = buildFineFeeItems(testData);
    
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('Late penalty');
    expect(result[0].amount).toBe('50');
    expect(result[1].name).toBe('ค่าละเมิด');
    expect(result[1].amount).toBe('1000');
  });
});
