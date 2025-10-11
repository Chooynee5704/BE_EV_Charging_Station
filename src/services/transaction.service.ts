import { Types } from "mongoose";
import {
  Transaction,
  ITransaction,
  TransactionStatus,
  PaymentMethod,
  IVnpayDetails,
} from "../models/transaction.model";
import { User } from "../models/user.model";
import { Reservation } from "../models/reservation.model";

export interface CreateTransactionInput {
  userId: string;
  reservationId?: string;
  amount: number;
  currency?: string;
  status?: TransactionStatus;
  paymentMethod: PaymentMethod;
  description?: string;
  vnpayDetails?: IVnpayDetails;
  metadata?: Record<string, any>;
}

export interface UpdateTransactionInput {
  transactionId: string;
  status?: TransactionStatus;
  vnpayDetails?: IVnpayDetails;
  metadata?: Record<string, any>;
}

export interface GetTransactionsFilter {
  userId?: string;
  status?: TransactionStatus | TransactionStatus[];
  paymentMethod?: PaymentMethod;
  fromDate?: Date;
  toDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface GetTransactionsOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Tạo giao dịch mới
 */
export async function createTransaction(
  input: CreateTransactionInput
): Promise<ITransaction> {
  // Validate user exists
  if (!Types.ObjectId.isValid(input.userId)) {
    throw Object.assign(new Error("User ID không hợp lệ"), { status: 400 });
  }

  const userExists = await User.findById(input.userId);
  if (!userExists) {
    throw Object.assign(new Error("Người dùng không tồn tại"), { status: 404 });
  }

  // Validate reservation if provided
  if (input.reservationId) {
    if (!Types.ObjectId.isValid(input.reservationId)) {
      throw Object.assign(new Error("Reservation ID không hợp lệ"), {
        status: 400,
      });
    }

    const reservationExists = await Reservation.findById(input.reservationId);
    if (!reservationExists) {
      throw Object.assign(new Error("Đặt chỗ không tồn tại"), { status: 404 });
    }
  }

  // Validate amount
  if (!input.amount || input.amount <= 0) {
    throw Object.assign(new Error("Số tiền phải lớn hơn 0"), { status: 400 });
  }

  const transaction = await Transaction.create({
    user: new Types.ObjectId(input.userId),
    reservation: input.reservationId
      ? new Types.ObjectId(input.reservationId)
      : undefined,
    amount: input.amount,
    currency: input.currency || "VND",
    status: input.status || "pending",
    paymentMethod: input.paymentMethod,
    description: input.description,
    vnpayDetails: input.vnpayDetails,
    metadata: input.metadata,
  });

  return transaction;
}

/**
 * Cập nhật trạng thái giao dịch
 */
export async function updateTransaction(
  input: UpdateTransactionInput
): Promise<ITransaction> {
  if (!Types.ObjectId.isValid(input.transactionId)) {
    throw Object.assign(new Error("Transaction ID không hợp lệ"), {
      status: 400,
    });
  }

  const transaction = await Transaction.findById(input.transactionId);
  if (!transaction) {
    throw Object.assign(new Error("Giao dịch không tồn tại"), { status: 404 });
  }

  // Update fields
  if (input.status !== undefined) {
    transaction.status = input.status;
  }
  if (input.vnpayDetails !== undefined) {
    transaction.vnpayDetails = {
      ...transaction.vnpayDetails,
      ...input.vnpayDetails,
    };
  }
  if (input.metadata !== undefined) {
    transaction.metadata = {
      ...transaction.metadata,
      ...input.metadata,
    };
  }

  await transaction.save();
  return transaction;
}

/**
 * Lấy chi tiết giao dịch theo ID
 */
export async function getTransactionById(
  transactionId: string,
  userId?: string
): Promise<ITransaction> {
  if (!Types.ObjectId.isValid(transactionId)) {
    throw Object.assign(new Error("Transaction ID không hợp lệ"), {
      status: 400,
    });
  }

  const query: any = { _id: transactionId };
  if (userId) {
    query.user = new Types.ObjectId(userId);
  }

  const transaction = await Transaction.findOne(query)
    .populate("user", "username email profile.fullName")
    .populate("reservation")
    .lean();

  if (!transaction) {
    throw Object.assign(new Error("Giao dịch không tồn tại"), { status: 404 });
  }

  return transaction as ITransaction;
}

/**
 * Lấy danh sách giao dịch với bộ lọc và phân trang
 */
export async function getTransactions(
  filter: GetTransactionsFilter,
  options: GetTransactionsOptions = {}
) {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  // Build query
  const query: any = {};

  if (filter.userId) {
    if (!Types.ObjectId.isValid(filter.userId)) {
      throw Object.assign(new Error("User ID không hợp lệ"), { status: 400 });
    }
    query.user = new Types.ObjectId(filter.userId);
  }

  if (filter.status) {
    if (Array.isArray(filter.status)) {
      query.status = { $in: filter.status };
    } else {
      query.status = filter.status;
    }
  }

  if (filter.paymentMethod) {
    query.paymentMethod = filter.paymentMethod;
  }

  // Date range filter
  if (filter.fromDate || filter.toDate) {
    query.createdAt = {};
    if (filter.fromDate) {
      query.createdAt.$gte = filter.fromDate;
    }
    if (filter.toDate) {
      query.createdAt.$lte = filter.toDate;
    }
  }

  // Amount range filter
  if (filter.minAmount !== undefined || filter.maxAmount !== undefined) {
    query.amount = {};
    if (filter.minAmount !== undefined) {
      query.amount.$gte = filter.minAmount;
    }
    if (filter.maxAmount !== undefined) {
      query.amount.$lte = filter.maxAmount;
    }
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sort: any = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("user", "username email profile.fullName")
      .populate("reservation")
      .lean(),
    Transaction.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Lấy thống kê giao dịch của user
 */
export async function getUserTransactionStats(userId: string) {
  if (!Types.ObjectId.isValid(userId)) {
    throw Object.assign(new Error("User ID không hợp lệ"), { status: 400 });
  }

  const userObjectId = new Types.ObjectId(userId);

  const stats = await Transaction.aggregate([
    { $match: { user: userObjectId } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  const totalTransactions = await Transaction.countDocuments({
    user: userObjectId,
  });

  const totalAmount = await Transaction.aggregate([
    { $match: { user: userObjectId, status: "success" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return {
    totalTransactions,
    totalSuccessAmount: totalAmount[0]?.total || 0,
    byStatus: stats.reduce((acc: any, stat: any) => {
      acc[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount,
      };
      return acc;
    }, {}),
  };
}

/**
 * Tìm giao dịch theo vnp_TxnRef
 */
export async function findTransactionByVnpTxnRef(
  vnpTxnRef: string
): Promise<ITransaction | null> {
  return await Transaction.findOne({
    "vnpayDetails.vnp_TxnRef": vnpTxnRef,
  }).lean();
}

/**
 * Tìm giao dịch theo vnp_TransactionNo
 */
export async function findTransactionByVnpTransactionNo(
  vnpTransactionNo: string
): Promise<ITransaction | null> {
  return await Transaction.findOne({
    "vnpayDetails.vnp_TransactionNo": vnpTransactionNo,
  }).lean();
}

/**
 * Lấy báo cáo giao dịch chi tiết (dạng bảng)
 * Bao gồm tất cả thông tin: ngày, tên, phương thức, trạng thái, lý do
 */
export interface TransactionReportItem {
  transactionId: string;
  transactionDate: Date;
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  description?: string;
  failureReason?: string;
  vnpayTransactionNo?: string;
  bankCode?: string;
  cardType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getTransactionReport(
  filter: GetTransactionsFilter,
  options: GetTransactionsOptions = {}
) {
  const {
    page = 1,
    limit = 50,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  // Build query
  const query: any = {};

  if (filter.userId) {
    if (!Types.ObjectId.isValid(filter.userId)) {
      throw Object.assign(new Error("User ID không hợp lệ"), { status: 400 });
    }
    query.user = new Types.ObjectId(filter.userId);
  }

  if (filter.status) {
    if (Array.isArray(filter.status)) {
      query.status = { $in: filter.status };
    } else {
      query.status = filter.status;
    }
  }

  if (filter.paymentMethod) {
    query.paymentMethod = filter.paymentMethod;
  }

  // Date range filter
  if (filter.fromDate || filter.toDate) {
    query.createdAt = {};
    if (filter.fromDate) {
      query.createdAt.$gte = filter.fromDate;
    }
    if (filter.toDate) {
      query.createdAt.$lte = filter.toDate;
    }
  }

  // Amount range filter
  if (filter.minAmount !== undefined || filter.maxAmount !== undefined) {
    query.amount = {};
    if (filter.minAmount !== undefined) {
      query.amount.$gte = filter.minAmount;
    }
    if (filter.maxAmount !== undefined) {
      query.amount.$lte = filter.maxAmount;
    }
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sort: any = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("user", "username email profile.fullName")
      .lean(),
    Transaction.countDocuments(query),
  ]);

  // Transform to report format
  const report: TransactionReportItem[] = transactions.map((txn: any) => ({
    transactionId: txn._id.toString(),
    transactionDate: txn.createdAt,
    userName: txn.user?.profile?.fullName || txn.user?.username || "N/A",
    userEmail: txn.user?.email || "N/A",
    amount: txn.amount,
    currency: txn.currency,
    paymentMethod: txn.paymentMethod,
    status: txn.status,
    description: txn.description,
    failureReason: txn.metadata?.failureReason,
    vnpayTransactionNo: txn.vnpayDetails?.vnp_TransactionNo,
    bankCode: txn.vnpayDetails?.vnp_BankCode,
    cardType: txn.vnpayDetails?.vnp_CardType,
    createdAt: txn.createdAt,
    updatedAt: txn.updatedAt,
  }));

  const totalPages = Math.ceil(total / limit);

  return {
    report,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    summary: {
      totalTransactions: total,
      // Count by status in current page
      statusCounts: report.reduce((acc: any, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}
