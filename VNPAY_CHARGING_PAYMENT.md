# VNPay Charging Session Payment Integration

## Overview
Modified VNPay payment APIs to support vehicle-based charging session payments. Users can now pay for multiple completed charging sessions in a single transaction.

## Changes Made

### 1. Modified Endpoints

#### POST /vnpay/checkout-url
**Previous Behavior:**
- Required `amount` and `orderInfo` parameters
- Used for general-purpose payments or reservations

**New Behavior:**
- Requires `vehicleId` parameter
- Automatically calculates payment amount from completed charging sessions
- Supports optional `locale` and `orderType` parameters

**Pricing Calculation:**
```typescript
// Get all completed sessions for vehicle
completedSessions = find({ vehicle: vehicleId, status: "completed" })

// Sum total minutes
totalMinutes = sum of (endAt - startAt) for each session

// Calculate pricing (matching frontend logic)
BOOKING_BASE_PRICE = {
  ac: 10,000 VND (fixed)
  dc: 15,000 VND (fixed)
  dc_ultra: 20,000 VND (fixed)
}
ENERGY_PRICE = 3,858 VND/kWh

durationHours = totalMinutes / 60
powerKw = port.powerKw (actual power from port, e.g., 7kW for AC, 50kW for DC)

bookingCost = BOOKING_BASE_PRICE[portType] (fixed, no multiplication)
energyKwh = powerKw × durationHours
energyCost = durationHours × energyKwh × ENERGY_PRICE
total = bookingCost + energyCost
```

**Response:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "paymentUrl": "https://sandbox.vnpayment.vn/...",
    "params": { ... },
    "pricingDetails": {
      "totalSessions": 3,
      "totalMinutes": 150.5,
      "durationHours": 2.5083,
      "portType": "dc",
      "powerKw": 50,
      "bookingBasePrice": 15000,
      "energyKwh": 125.415,
      "bookingCost": 15000,
      "energyCost": 1212674,
      "total": 1227674,
      "currency": "VND"
    }
  }
}
```

#### POST /vnpay/check-payment-status
**Previous Behavior:**
- Verified VNPay return parameters
- Updated reservation status based on payment

**New Behavior:**
- Requires `vehicleId` parameter
- **Requires VNPay callback parameters** (vnp_TxnRef, vnp_SecureHash, etc.)
- **Verifies VNPay signature** to ensure payment authenticity
- Finds transaction by `vnp_TxnRef`
- If payment successful (`responseCode: "00"`):
  - Updates all `completed` sessions to `success` status
  - Updates all associated slots to `available` status
  
**Request Body:**
```json
{
  "vehicleId": "60d5ec49f1b2c72b8c8e4f1a",
  "vnp_Amount": "1816800",
  "vnp_BankCode": "NCB",
  "vnp_BankTranNo": "VNP15252785",
  "vnp_CardType": "ATM",
  "vnp_OrderInfo": "Thanh toan 28 phien sac - Xe 25H-HG154",
  "vnp_PayDate": "20251111141447",
  "vnp_ResponseCode": "00",
  "vnp_TmnCode": "KNEEJVLV",
  "vnp_TransactionNo": "15252785",
  "vnp_TransactionStatus": "00",
  "vnp_TxnRef": "CHARGE-6912c50319693ba338c1fd14-1762845266362",
  "vnp_SecureHash": "91c0869aa912916ef3941c8eec428893068f05f93396c21f13896bf9d3bd429239d9efbf4e433c5f555ed63841a6d54cffb88dd50d7639c24b9f6f0a38ab2548"
}
```
  
**Response (Success):**
```json
{
  "success": true,
  "message": "Thanh toán thành công và đã cập nhật trạng thái",
  "data": {
    "paymentStatus": "success",
    "transactionId": "...",
    "amount": 1227674,
    "currency": "VND",
    "updatedSessions": 3,
    "updatedSlots": 3,
    "sessionIds": ["...", "...", "..."],
    "slotIds": ["...", "...", "..."],
    "vnpayInfo": {
      "responseCode": "00",
      "transactionNo": "15252785",
      "bankCode": "NCB",
      "cardType": "ATM",
      "payDate": "20251111141447"
    }
  }
}
```

**Response (Failed/Cancelled):**
```json
{
  "success": true,
  "message": "Thanh toán thất bại",
  "data": {
    "paymentStatus": "failed",
    "transactionId": "...",
    "amount": 1227674,
    "currency": "VND",
    "reason": "Insufficient balance",
    "vnpayInfo": {
      "responseCode": "51",
      "transactionNo": "15252785",
      "bankCode": "NCB"
    }
  }
}
```

**Response (Invalid Signature):**
```json
{
  "success": false,
  "error": "InvalidSignature",
  "message": "Chữ ký VNPay không hợp lệ",
  "data": {
    "paymentStatus": "invalid"
  }
}
```

### 2. ChargingSession Model Updates

Added new status: `"success"`

**Updated Status Flow:**
```
active → completed (charging finished)
completed → success (payment completed)
completed → completed (payment pending/failed)
```

**Status Enum:**
```typescript
export type ChargingSessionStatus = 
  | "active"      // Currently charging
  | "completed"   // Charging finished, awaiting payment
  | "cancelled"   // Cancelled by user/system
  | "success";    // Payment completed
```

**Pre-save Hook:**
- When status changes to `completed`, `cancelled`, or `success` → slot status becomes `available`

### 3. Transaction Metadata

Transactions created for charging session payments include:

```typescript
{
  userId: "...",
  amount: 1227674,
  currency: "VND",
  status: "pending", // → "success" after payment
  paymentMethod: "vnpay",
  description: "Thanh toan 3 phien sac - Xe 29A-12345",
  vnpayDetails: {
    vnp_TxnRef: "CHARGE-{vehicleId}-{timestamp}",
    vnp_Amount: 122767400,
    vnp_OrderInfo: "Thanh toan 3 phien sac - Xe 29A-12345"
  },
  metadata: {
    ipAddr: "...",
    createdFrom: "checkout_url_charging",
    vehicleId: "...",
    sessionCount: 3,
    totalMinutes: 150.5,
    durationHours: 2.5083,
    portType: "dc",
    powerKw: 50,
    bookingCost: 15000,
    energyCost: 1212674,
    sessionDetails: [
      {
        sessionId: "...",
        startAt: "2025-01-14T10:00:00Z",
        endAt: "2025-01-14T10:45:00Z",
        minutes: 45,
        port: { type: "DC", powerKw: 50, ... }
      },
      ...
    ]
  }
}
```

## Usage Flow

### Complete Charging Session Payment Flow

```
1. User charges vehicle
   POST /charging/start
   → session status: "active"
   → slot status: "in_use"

2. User stops charging
   POST /charging/stop
   → session status: "completed"
   → slot status: "available"

3. User requests payment URL (can have multiple completed sessions)
   POST /vnpay/checkout-url
   Body: { vehicleId: "..." }
   → Gets paymentUrl with total cost
   → Transaction created with status: "pending"

4. User completes payment on VNPay
   → VNPay redirects to /vnpay/return
   → Transaction status updated to "success"

5. Frontend calls check payment status
   POST /vnpay/check-payment-status
   Body: { 
     vehicleId: "...",
     vnp_Amount: "1816800",
     vnp_ResponseCode: "00",
     vnp_TxnRef: "CHARGE-...",
     vnp_SecureHash: "...",
     ... (all VNPay callback params)
   }
   → Verifies VNPay signature
   → Updates all completed sessions to "success"
   → Updates all slots to "available"
   → Returns confirmation

6. User can see payment history in transactions
```

## Error Handling

### Validation Errors
- `vehicleId` is required and must be valid ObjectId
- `vnp_TxnRef` and `vnp_SecureHash` are required for payment verification
- Vehicle must exist and belong to authenticated user
- VNPay signature must be valid

### Business Logic Errors
- If VNPay signature invalid: "Chữ ký VNPay không hợp lệ"
- If transaction not found: "Không tìm thấy giao dịch thanh toán với mã {vnp_TxnRef}"
- If transaction doesn't belong to user: "Giao dịch không thuộc về bạn"
- If vehicleId doesn't match transaction: "vehicleId không khớp với giao dịch"

## Security

### Authorization
- Both endpoints require authentication (`authenticateToken`)
- Both endpoints require user role (`authorizeRoles("admin", "staff", "user")`)

### Ownership Validation
- Vehicle ownership verified against `req.user.userId`
- Transaction ownership verified against `req.user.userId`
- Only vehicle owner can create payment or check status

### Transaction Integrity
- VNPay signature verification using HMAC-SHA512
- Uses `vnp_TxnRef` to find transaction
- Metadata tracks `createdFrom: "checkout_url_charging"` to identify charging-related transactions
- Timing-safe comparison for signature verification

## Database Updates

### When Payment Succeeds
```typescript
// Update sessions
ChargingSession.updateMany(
  { _id: { $in: sessionIds } },
  { $set: { status: "success" } }
)

// Update slots (handled by pre-save hook when status changes)
ChargingSlot.updateMany(
  { _id: { $in: slotIds } },
  { $set: { status: "available" } }
)
```

## Testing Checklist

- [ ] Create charging session for vehicle
- [ ] Stop charging (status → completed)
- [ ] Call checkout-url with vehicleId
- [ ] Verify pricing calculation matches /pricing/estimate
- [ ] Complete payment on VNPay sandbox
- [ ] Call check-payment-status
- [ ] Verify sessions updated to "success"
- [ ] Verify slots updated to "available"
- [ ] Test with multiple sessions
- [ ] Test with different port types (AC, DC, DC Ultra)
- [ ] Test unauthorized access (different user's vehicle)
- [ ] Test with no completed sessions
- [ ] Test with pending payment (not yet completed on VNPay)

## Notes

- Port type detection uses first session's port (assumes same type for all sessions)
- If sessions use different port types, only first type is considered for pricing
- Slot status update happens both in pre-save hook AND explicitly in check-payment-status
- Transaction metadata includes detailed session information for audit trail
- Energy calculation uses fixed 1kW power assumption (same as /pricing/estimate)
