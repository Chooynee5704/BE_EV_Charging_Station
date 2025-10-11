# Tính năng Quản lý Lịch sử Giao dịch

## Tổng quan

Tính năng này cho phép quản lý và theo dõi lịch sử giao dịch thanh toán của người dùng trong hệ thống EV Charging Management. Tính năng tích hợp với cổng thanh toán VNPay và tự động ghi nhận các giao dịch.

## Cấu trúc Files

### 1. Model
- **`src/models/transaction.model.ts`**: Định nghĩa schema và interface cho Transaction
  - Lưu trữ thông tin giao dịch (người dùng, số tiền, trạng thái, phương thức thanh toán)
  - Tích hợp chi tiết từ VNPay (mã giao dịch, ngân hàng, thẻ, v.v.)
  - Hỗ trợ liên kết với Reservation

### 2. Service
- **`src/services/transaction.service.ts`**: Xử lý logic nghiệp vụ
  - `createTransaction()`: Tạo giao dịch mới
  - `updateTransaction()`: Cập nhật trạng thái giao dịch
  - `getTransactionById()`: Lấy chi tiết giao dịch
  - `getTransactions()`: Lấy danh sách giao dịch với filter và phân trang
  - `getUserTransactionStats()`: Thống kê giao dịch theo user
  - `findTransactionByVnpTxnRef()`: Tìm giao dịch theo mã VNPay

### 3. Controller
- **`src/controllers/transaction.controller.ts`**: Xử lý HTTP requests
  - Validate input từ client
  - Phân quyền xem giao dịch (user, admin, staff)
  - Xử lý lỗi và trả về response

### 4. Routes
- **`src/routes/transaction.routes.ts`**: Định nghĩa API endpoints
  - Cấu hình middleware authentication và authorization
  - Tài liệu Swagger cho từng endpoint

### 5. Integration với VNPay
- **`src/controllers/vnpay.controller.ts`**: Đã được cập nhật
  - Tự động tạo transaction khi tạo checkout URL
  - Cập nhật trạng thái transaction từ return URL
  - Xử lý IPN callback từ VNPay để cập nhật transaction

## API Endpoints

### 1. Lấy lịch sử giao dịch của user hiện tại
```
GET /transactions/my-history
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`: Số trang (mặc định: 1)
- `limit`: Số lượng/trang (mặc định: 10)
- `status`: Lọc theo trạng thái (pending, processing, success, failed, cancelled, refunded)
- `paymentMethod`: Lọc theo phương thức (vnpay, cash, other)
- `fromDate`: Từ ngày (ISO format)
- `toDate`: Đến ngày (ISO format)
- `minAmount`: Số tiền tối thiểu
- `maxAmount`: Số tiền tối đa
- `sortBy`: Sắp xếp theo field (mặc định: createdAt)
- `sortOrder`: Thứ tự (asc/desc, mặc định: desc)

**Response:**
```json
{
  "success": true,
  "message": "Lấy lịch sử giao dịch thành công",
  "data": [
    {
      "id": "...",
      "user": {...},
      "amount": 100000,
      "currency": "VND",
      "status": "success",
      "paymentMethod": "vnpay",
      "description": "Thanh toán đặt chỗ sạc xe",
      "vnpayDetails": {
        "vnp_TxnRef": "...",
        "vnp_TransactionNo": "...",
        "vnp_BankCode": "NCB",
        "vnp_ResponseCode": "00"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:05:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 2. Lấy thống kê giao dịch của user hiện tại
```
GET /transactions/my-stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Lấy thống kê giao dịch thành công",
  "data": {
    "totalTransactions": 50,
    "totalSuccessAmount": 5000000,
    "byStatus": {
      "success": {
        "count": 45,
        "totalAmount": 5000000
      },
      "failed": {
        "count": 3,
        "totalAmount": 150000
      },
      "pending": {
        "count": 2,
        "totalAmount": 100000
      }
    }
  }
}
```

### 3. Lấy danh sách giao dịch (Admin/Staff xem tất cả, User xem của mình)
```
GET /transactions
Authorization: Bearer <token>
```

**Query Parameters:** (Giống như `/my-history` + thêm `userId` cho admin/staff)

### 4. Lấy chi tiết giao dịch
```
GET /transactions/:id
Authorization: Bearer <token>
```

### 5. Tạo giao dịch thủ công (Admin/Staff only)
```
POST /transactions
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "userId": "user_id_here",
  "reservationId": "reservation_id_here",  // optional
  "amount": 100000,
  "currency": "VND",
  "status": "pending",
  "paymentMethod": "cash",
  "description": "Thanh toán tiền mặt"
}
```

### 6. Lấy thống kê giao dịch của user bất kỳ (Admin/Staff only)
```
GET /transactions/stats/:userId
Authorization: Bearer <token>
```

### 7. Lấy báo cáo giao dịch chi tiết của user (Dạng bảng)
```
GET /transactions/my-report
Authorization: Bearer <token>
```

**Response (Bảng giao dịch chi tiết):**
```json
{
  "success": true,
  "message": "Lấy báo cáo giao dịch thành công",
  "data": [
    {
      "transactionId": "67890...",
      "transactionDate": "2024-01-15T10:30:00.000Z",
      "userName": "Nguyễn Văn A",
      "userEmail": "nguyenvana@example.com",
      "amount": 100000,
      "currency": "VND",
      "paymentMethod": "vnpay",
      "status": "success",
      "description": "Thanh toán đặt chỗ sạc xe",
      "failureReason": null,
      "vnpayTransactionNo": "14234567",
      "bankCode": "NCB",
      "cardType": "ATM",
      "createdAt": "2024-01-15T10:25:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "transactionId": "67891...",
      "transactionDate": "2024-01-14T15:20:00.000Z",
      "userName": "Nguyễn Văn A",
      "userEmail": "nguyenvana@example.com",
      "amount": 50000,
      "currency": "VND",
      "paymentMethod": "vnpay",
      "status": "failed",
      "description": "Thanh toán đặt chỗ sạc xe",
      "failureReason": "Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch",
      "vnpayTransactionNo": "14234568",
      "bankCode": "NCB",
      "cardType": "ATM",
      "createdAt": "2024-01-14T15:15:00.000Z",
      "updatedAt": "2024-01-14T15:20:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  },
  "summary": {
    "totalTransactions": 2,
    "statusCounts": {
      "success": 1,
      "failed": 1
    }
  }
}
```

### 8. Lấy báo cáo giao dịch tổng hợp (Admin/Staff only - Dạng bảng)
```
GET /transactions/report?userId=...&status=failed&fromDate=2024-01-01
Authorization: Bearer <token>
```

**Query Parameters:**
- `userId`: Lọc theo user ID (optional)
- `status`: Lọc theo trạng thái (có thể dùng dấu phẩy: `success,failed`)
- `paymentMethod`: Lọc theo phương thức thanh toán
- `fromDate`, `toDate`: Lọc theo khoảng thời gian
- `page`, `limit`: Phân trang (default limit: 50)
- `sortBy`, `sortOrder`: Sắp xếp

## Trạng thái Giao dịch (Transaction Status)

- **`pending`**: Đang chờ xử lý (vừa tạo, chưa thanh toán)
- **`processing`**: Đang xử lý thanh toán
- **`success`**: Thanh toán thành công (VNPay response code = "00")
- **`failed`**: Thanh toán thất bại (không đủ tiền, thẻ bị khóa, v.v.)
- **`cancelled`**: Khách hàng hủy giao dịch (VNPay response code = "24")
- **`refunded`**: Đã hoàn tiền

## Phương thức Thanh toán (Payment Method)

- **`vnpay`**: Thanh toán qua VNPay
- **`cash`**: Tiền mặt
- **`other`**: Phương thức khác

## Cách hoạt động của Transaction Recording

### ✅ Tất cả giao dịch đều được ghi nhận

1. **Khi tạo thanh toán** (POST `/vnpay/checkout-url`):
   - Hệ thống **ngay lập tức tạo transaction** với status `pending`
   - Transaction được lưu vào database ngay khi user click thanh toán
   - **Điều này đảm bảo mọi giao dịch đều được ghi nhận**, dù user có hoàn thành thanh toán hay không

2. **Khi thanh toán hoàn tất** (Return URL / IPN callback):
   - Hệ thống **cập nhật status** của transaction:
     - `success` nếu thanh toán thành công (code "00")
     - `failed` nếu thất bại (không đủ tiền, thẻ bị khóa, v.v.)
     - `cancelled` nếu user hủy (code "24")
   - **Nếu thất bại**, lý do được lưu vào `metadata.failureReason`

3. **Xem báo cáo**:
   - User có thể xem tất cả giao dịch của mình qua `/transactions/my-report`
   - Admin/Staff có thể xem tất cả giao dịch qua `/transactions/report`
   - Báo cáo bao gồm đầy đủ: ngày, tên, email, số tiền, phương thức, trạng thái, **lý do thất bại**

## Flow Thanh toán VNPay

1. **User tạo yêu cầu thanh toán**:
   - POST `/vnpay/checkout-url` với thông tin `amount`, `orderInfo`, `reservationId` (optional)
   - ✅ **Hệ thống tạo transaction với status `pending` ngay lập tức**
   - Trả về URL thanh toán VNPay

2. **User thanh toán trên VNPay**:
   - User được redirect đến VNPay
   - User thực hiện thanh toán

3. **VNPay callback**:
   - **Return URL** (GET `/vnpay/return`): User được redirect về sau khi thanh toán
     - Hệ thống cập nhật transaction status dựa trên response code:
       - Code "00" → `success`
       - Code "24" → `cancelled` (user hủy)
       - Các code khác → `failed` (không đủ tiền, thẻ bị khóa, v.v.)
     - Lưu lý do thất bại vào `metadata.failureReason`
   - **IPN** (GET `/vnpay/ipn`): VNPay gọi server-to-server
     - Xác minh chữ ký
     - Kiểm tra idempotency (không xử lý lại nếu đã thành công)
     - Verify số tiền
     - Cập nhật transaction status tương tự Return URL

## VNPay Response Codes

Hệ thống tự động xử lý các mã lỗi từ VNPay:

| Code | Ý nghĩa | Transaction Status |
|------|---------|-------------------|
| 00 | Giao dịch thành công | `success` |
| 07 | Trừ tiền thành công, giao dịch bị nghi ngờ gian lận | `failed` |
| 09 | Thẻ/Tài khoản chưa đăng ký InternetBanking | `failed` |
| 10 | Xác thực thông tin không đúng quá 3 lần | `failed` |
| 11 | Hết hạn chờ thanh toán | `failed` |
| 12 | Thẻ/Tài khoản bị khóa | `failed` |
| 13 | Nhập sai mật khẩu OTP | `failed` |
| 24 | Khách hàng hủy giao dịch | `cancelled` |
| **51** | **Tài khoản không đủ số dư** | `failed` |
| 65 | Vượt quá hạn mức giao dịch trong ngày | `failed` |
| 75 | Ngân hàng đang bảo trì | `failed` |
| 79 | Nhập sai mật khẩu quá số lần quy định | `failed` |
| 99 | Các lỗi khác | `failed` |

**Lưu ý đặc biệt về Code 51 (Không đủ tiền):**
- Transaction status được set thành `failed`
- Lý do được lưu trong `metadata.failureReason`: "Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch"
- Frontend có thể hiển thị thông báo cho user biết cần nạp thêm tiền

## Phân quyền

### User (role: "user")
- Xem lịch sử giao dịch của chính mình
- Xem thống kê giao dịch của chính mình
- Tạo thanh toán VNPay

### Staff (role: "staff")
- Tất cả quyền của User
- Xem tất cả giao dịch trong hệ thống
- Tạo giao dịch thủ công
- Xem thống kê của bất kỳ user nào

### Admin (role: "admin")
- Tất cả quyền của Staff
- Quản lý toàn bộ hệ thống giao dịch

## Database Schema

### Transaction Collection
```javascript
{
  user: ObjectId,              // ref -> User (required)
  reservation: ObjectId,       // ref -> Reservation (optional)
  amount: Number,              // Số tiền (VND) (required)
  currency: String,            // Loại tiền tệ (default: "VND")
  status: String,              // Trạng thái (required)
  paymentMethod: String,       // Phương thức thanh toán (required)
  description: String,         // Mô tả giao dịch
  vnpayDetails: {              // Chi tiết từ VNPay
    vnp_TxnRef: String,        // Mã đơn hàng
    vnp_TransactionNo: String, // Mã giao dịch VNPay
    vnp_BankCode: String,      // Mã ngân hàng
    vnp_CardType: String,      // Loại thẻ
    vnp_ResponseCode: String,  // Mã phản hồi
    vnp_TransactionStatus: String, // Trạng thái giao dịch
    vnp_Amount: Number,        // Số tiền (VND * 100)
    vnp_PayDate: String,       // Thời gian thanh toán
    vnp_OrderInfo: String      // Thông tin đơn hàng
  },
  metadata: Object,            // Thông tin bổ sung
  createdAt: Date,             // Tự động
  updatedAt: Date              // Tự động
}
```

### Indexes
- `{ user: 1, createdAt: -1 }`: Query lịch sử theo user
- `{ user: 1, status: 1, createdAt: -1 }`: Lọc theo trạng thái
- `{ "vnpayDetails.vnp_TxnRef": 1 }`: Tìm theo mã VNPay
- `{ "vnpayDetails.vnp_TransactionNo": 1 }`: Tìm theo mã giao dịch VNPay

## Testing

### 1. Test với Postman/Thunder Client

**Tạo thanh toán:**
```bash
POST http://localhost:3000/vnpay/checkout-url
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "amount": 100000,
  "orderInfo": "Thanh toán đặt chỗ sạc xe",
  "reservationId": "reservation_id_here"
}
```

**Xem lịch sử:**
```bash
GET http://localhost:3000/transactions/my-history?page=1&limit=10&status=success
Authorization: Bearer <your_token>
```

**Xem lịch sử giao dịch thất bại:**
```bash
GET http://localhost:3000/transactions/my-history?status=failed
Authorization: Bearer <your_token>
```

**Xem lịch sử theo trạng thái:**
```bash
GET http://localhost:3000/transactions/my-history?status=success,failed,cancelled
Authorization: Bearer <your_token>
```

**Xem thống kê:**
```bash
GET http://localhost:3000/transactions/my-stats
Authorization: Bearer <your_token>
```

**Xem báo cáo chi tiết (dạng bảng):**
```bash
GET http://localhost:3000/transactions/my-report?page=1&limit=50
Authorization: Bearer <your_token>
```

**Xem chỉ giao dịch thất bại với lý do:**
```bash
GET http://localhost:3000/transactions/my-report?status=failed
Authorization: Bearer <your_token>
```

**Admin xem tất cả giao dịch thất bại:**
```bash
GET http://localhost:3000/transactions/report?status=failed&fromDate=2024-01-01
Authorization: Bearer <admin_token>
```

### 2. Test VNPay Sandbox

- Sử dụng thông tin test card từ VNPay
- URL sandbox: https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
- Test bankCode: "NCB" hoặc omit

**Test các trường hợp:**

1. **Thanh toán thành công**: Sử dụng thông tin thẻ test hợp lệ
   - Transaction sẽ chuyển từ `pending` → `success`

2. **Không đủ tiền** (Response Code 51): 
   - Trong môi trường test, có thể simulate bằng cách chọn option tương ứng
   - Transaction sẽ chuyển từ `pending` → `failed`
   - `metadata.failureReason` = "Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch"

3. **User hủy giao dịch** (Response Code 24):
   - Click "Hủy giao dịch" trên trang VNPay
   - Transaction sẽ chuyển từ `pending` → `cancelled`

4. **Hết hạn thanh toán** (Response Code 11):
   - Đợi quá 15 phút không thanh toán
   - Transaction sẽ chuyển từ `pending` → `failed`

## Bảng Thống Kê Giao Dịch

### Cột trong báo cáo giao dịch:

| Cột | Ý nghĩa | Ví dụ |
|-----|---------|-------|
| `transactionId` | Mã giao dịch | "67890abc..." |
| `transactionDate` | Ngày giờ giao dịch | "2024-01-15T10:30:00Z" |
| `userName` | Tên người dùng | "Nguyễn Văn A" |
| `userEmail` | Email người dùng | "user@example.com" |
| `amount` | Số tiền (VND) | 100000 |
| `currency` | Loại tiền tệ | "VND" |
| `paymentMethod` | Phương thức thanh toán | "vnpay", "cash" |
| `status` | Trạng thái | "success", "failed", "cancelled", "pending" |
| `description` | Mô tả giao dịch | "Thanh toán đặt chỗ..." |
| **`failureReason`** | **Lý do thất bại** | "Tài khoản không đủ số dư..." |
| `vnpayTransactionNo` | Mã GD VNPay | "14234567" |
| `bankCode` | Ngân hàng | "NCB" |
| `cardType` | Loại thẻ | "ATM", "QRCODE" |
| `createdAt` | Thời gian tạo | "2024-01-15T10:25:00Z" |
| `updatedAt` | Thời gian cập nhật | "2024-01-15T10:30:00Z" |

### Ví dụ về lý do thất bại (failureReason):

- ✅ **Null**: Giao dịch thành công hoặc đang pending
- ❌ **"Tài khoản không đủ số dư..."**: Code 51 - Không đủ tiền
- ❌ **"Thẻ/Tài khoản bị khóa"**: Code 12 - Thẻ bị khóa
- ❌ **"Khách hàng hủy giao dịch"**: Code 24 - User tự hủy
- ❌ **"Hết hạn chờ thanh toán..."**: Code 11 - Timeout
- ❌ **"Vượt quá hạn mức..."**: Code 65 - Vượt hạn mức

## Notes

- ✅ **Tất cả giao dịch đều được tạo và lưu trữ** (cả thành công lẫn thất bại)
- ✅ **Mọi giao dịch thất bại đều có lý do cụ thể** trong `failureReason`
- ✅ Transaction được tạo **ngay khi user click thanh toán**, không phụ thuộc vào kết quả
- Transaction status chỉ có thể thay đổi theo flow hợp lệ (pending → success/failed/cancelled)
- VNPay IPN có cơ chế idempotency để tránh xử lý trùng
- Số tiền luôn được lưu ở đơn vị VND (VNPay yêu cầu *100 khi gửi)
- Mọi thay đổi về transaction đều được ghi log vào `metadata`
- Báo cáo có thể export sang CSV/Excel bằng cách xử lý response data ở frontend

## Swagger Documentation

Sau khi start server, truy cập: http://localhost:3000/api-docs để xem tài liệu API đầy đủ với Swagger UI.

## Files được tạo/sửa đổi

### Tạo mới:
1. `src/models/transaction.model.ts`
2. `src/services/transaction.service.ts`
3. `src/controllers/transaction.controller.ts`
4. `src/routes/transaction.routes.ts`

### Sửa đổi:
1. `src/controllers/vnpay.controller.ts` - Thêm logic tạo và cập nhật transaction
2. `src/index.ts` - Import và mount transaction routes

## Next Steps (Tùy chọn)

1. **Webhook notifications**: Gửi email/SMS khi giao dịch thành công/thất bại
2. **Export transactions**: Xuất báo cáo giao dịch ra Excel/PDF
3. **Refund support**: Hỗ trợ hoàn tiền
4. **Multi-currency**: Hỗ trợ nhiều loại tiền tệ
5. **Transaction disputes**: Xử lý tranh chấp giao dịch
6. **Analytics dashboard**: Dashboard thống kê chi tiết

