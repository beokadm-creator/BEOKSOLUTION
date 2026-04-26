/**
 * Unit tests for payment/toss.ts
 */

import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

import { approveTossPayment, cancelTossPayment } from '../toss';

describe('approveTossPayment', () => {
  const paymentKey = 'pg_key_abc123';
  const orderId = 'order_xyz789';
  const amount = 50000;
  const secretKey = 'test_sk_12345';
  const storeId = 'store_001';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should construct correct Authorization header with Basic base64 encoding', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'DONE' } });

    await approveTossPayment(paymentKey, orderId, amount, secretKey);

    const callArgs = mockedAxios.post.mock.calls[0]!;
    const config = callArgs[2] as { headers: Record<string, string> };
    const authHeader = config.headers['Authorization'];
    const expected = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

    expect(authHeader).toBe(expected);
    expect(authHeader).toMatch(/^Basic /);
  });

  it('should send correct request body with paymentKey, orderId, and amount', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'DONE' } });

    await approveTossPayment(paymentKey, orderId, amount, secretKey);

    const callArgs = mockedAxios.post.mock.calls[0]!;
    const body = callArgs[1] as { paymentKey: string; orderId: string; amount: number };

    expect(body).toEqual({
      paymentKey,
      orderId,
      amount,
    });
  });

  it('should include storeId in request body when provided', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'DONE' } });

    await approveTossPayment(paymentKey, orderId, amount, secretKey, storeId);

    const callArgs = mockedAxios.post.mock.calls[0]!;
    const body = callArgs[1] as { paymentKey: string; orderId: string; amount: number; storeId?: string };

    expect(body).toEqual({
      paymentKey,
      orderId,
      amount,
      storeId,
    });
  });

  it('should not include storeId when not provided', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'DONE' } });

    await approveTossPayment(paymentKey, orderId, amount, secretKey);

    const callArgs = mockedAxios.post.mock.calls[0]!;
    const body = callArgs[1] as Record<string, unknown>;

    expect(body).not.toHaveProperty('storeId');
  });

  it('should not include storeId when null is provided', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'DONE' } });

    await approveTossPayment(paymentKey, orderId, amount, secretKey, null);

    const callArgs = mockedAxios.post.mock.calls[0];
    const body = callArgs[1];

    expect(body).not.toHaveProperty('storeId');
  });

  it('should post to correct Toss Payments URL', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'DONE' } });

    await approveTossPayment(paymentKey, orderId, amount, secretKey);

    const callArgs = mockedAxios.post.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.tosspayments.com/v1/payments/confirm');
  });

  it('should set Content-Type to application/json', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'DONE' } });

    await approveTossPayment(paymentKey, orderId, amount, secretKey);

    const callArgs = mockedAxios.post.mock.calls[0];
    const config = callArgs[2] as { headers: Record<string, string> };
    expect(config.headers['Content-Type']).toBe('application/json');
  });

  it('should return response.data on success', async () => {
    const responseData = { status: 'DONE', orderId: 'order_xyz789', totalAmount: 50000 };
    mockedAxios.post.mockResolvedValue({ data: responseData });

    const result = await approveTossPayment(paymentKey, orderId, amount, secretKey);

    expect(result).toEqual(responseData);
  });

  it('should throw with API error message on response error', async () => {
    const apiMessage = '결제 승인에 실패했습니다.';
    mockedAxios.post.mockRejectedValue({
      response: { data: { message: apiMessage } },
    });

    await expect(
      approveTossPayment(paymentKey, orderId, amount, secretKey)
    ).rejects.toThrow(apiMessage);
  });

  it('should throw generic message when API response has no message', async () => {
    mockedAxios.post.mockRejectedValue({
      response: { data: {} },
    });

    await expect(
      approveTossPayment(paymentKey, orderId, amount, secretKey)
    ).rejects.toThrow('Payment Approval Failed');
  });

  it('should throw generic message on non-response errors', async () => {
    mockedAxios.post.mockRejectedValue(new Error('Network timeout'));

    await expect(
      approveTossPayment(paymentKey, orderId, amount, secretKey)
    ).rejects.toThrow('Payment Approval Failed');
  });

  it('should handle zero amount', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'DONE' } });

    await approveTossPayment(paymentKey, orderId, 0, secretKey);

    const body = mockedAxios.post.mock.calls[0][1] as { amount: number };
    expect(body.amount).toBe(0);
  });

  it('should handle large amount', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'DONE' } });

    await approveTossPayment(paymentKey, orderId, 99999999, secretKey);

    const body = mockedAxios.post.mock.calls[0][1] as { amount: number };
    expect(body.amount).toBe(99999999);
  });
});

describe('cancelTossPayment', () => {
  const paymentKey = 'pg_key_cancel_123';
  const cancelReason = '고객 요청 취소';
  const secretKey = 'test_sk_cancel';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should construct correct URL with paymentKey', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'CANCELED' } });

    await cancelTossPayment(paymentKey, cancelReason, secretKey);

    const callArgs = mockedAxios.post.mock.calls[0];
    expect(callArgs[0]).toBe(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`);
  });

  it('should send cancelReason in request body', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'CANCELED' } });

    await cancelTossPayment(paymentKey, cancelReason, secretKey);

    const callArgs = mockedAxios.post.mock.calls[0];
    const body = callArgs[1];

    expect(body).toEqual({ cancelReason });
  });

  it('should construct correct Authorization header', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'CANCELED' } });

    await cancelTossPayment(paymentKey, cancelReason, secretKey);

    const callArgs = mockedAxios.post.mock.calls[0];
    const config = callArgs[2] as { headers: Record<string, string> };
    const authHeader = config.headers['Authorization'];
    const expected = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

    expect(authHeader).toBe(expected);
  });

  it('should set Content-Type to application/json', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'CANCELED' } });

    await cancelTossPayment(paymentKey, cancelReason, secretKey);

    const callArgs = mockedAxios.post.mock.calls[0];
    const config = callArgs[2] as { headers: Record<string, string> };
    expect(config.headers['Content-Type']).toBe('application/json');
  });

  it('should return response.data on success', async () => {
    const responseData = { status: 'CANCELED', paymentKey };
    mockedAxios.post.mockResolvedValue({ data: responseData });

    const result = await cancelTossPayment(paymentKey, cancelReason, secretKey);

    expect(result).toEqual(responseData);
  });

  it('should throw with API error message on cancel failure', async () => {
    const apiMessage = '이미 취소된 결제입니다.';
    mockedAxios.post.mockRejectedValue({
      response: { data: { message: apiMessage } },
    });

    await expect(
      cancelTossPayment(paymentKey, cancelReason, secretKey)
    ).rejects.toThrow(apiMessage);
  });

  it('should throw generic message when API response has no message', async () => {
    mockedAxios.post.mockRejectedValue({
      response: { data: {} },
    });

    await expect(
      cancelTossPayment(paymentKey, cancelReason, secretKey)
    ).rejects.toThrow('Payment Cancellation Failed');
  });

  it('should throw generic message on non-response errors', async () => {
    mockedAxios.post.mockRejectedValue(new Error('Network error'));

    await expect(
      cancelTossPayment(paymentKey, cancelReason, secretKey)
    ).rejects.toThrow('Payment Cancellation Failed');
  });

  it('should handle empty cancel reason', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'CANCELED' } });

    await cancelTossPayment(paymentKey, '', secretKey);

    const body = mockedAxios.post.mock.calls[0][1];
    expect(body).toEqual({ cancelReason: '' });
  });
});
