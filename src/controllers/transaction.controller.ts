import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import {
  createTransaction,
  getTransactionById,
  getTransactions,
  getUserTransactionStats,
  getTransactionReport,
  GetTransactionsFilter,
  GetTransactionsOptions,
} from "../services/transaction.service";

/**
 * Tạo giao dịch mới (thường được gọi nội bộ hoặc từ webhook)
 * POST /transactions
 */
export async function createTransactionController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const {
      userId,
      reservationId,
      amount,
      currency,
      status,
      paymentMethod,
      description,
      vnpayDetails,
      metadata,
    } = req.body;

    // Validate required fields
    if (!userId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "userId, amount và paymentMethod là bắt buộc",
      });
    }

    const transaction = await createTransaction({
      userId,
      reservationId,
      amount,
      currency,
      status,
      paymentMethod,
      description,
      vnpayDetails,
      metadata,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo giao dịch thành công",
      data: transaction,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi tạo giao dịch",
    });
  }
}

/**
 * Lấy chi tiết giao dịch theo ID
 * GET /transactions/:id
 */
export async function getTransactionByIdController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Transaction ID là bắt buộc",
      });
    }

    const userId = req.user?.userId;

    // Admin và staff có thể xem tất cả giao dịch
    // User chỉ có thể xem giao dịch của mình
    const canViewAll = req.user?.role === "admin" || req.user?.role === "staff";
    let filterUserId: string | undefined;
    if (!canViewAll && userId) {
      filterUserId = userId;
    }

    const transaction = await getTransactionById(id, filterUserId);

    return res.status(200).json({
      success: true,
      message: "Lấy thông tin giao dịch thành công",
      data: transaction,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi lấy thông tin giao dịch",
    });
  }
}

/**
 * Lấy danh sách giao dịch (có phân trang và bộ lọc)
 * GET /transactions
 */
export async function getTransactionsController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Query params
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      paymentMethod,
      fromDate,
      toDate,
      minAmount,
      maxAmount,
      userId: queryUserId, // Admin/staff có thể lọc theo userId
    } = req.query;

    // Build filter
    const filter: GetTransactionsFilter = {};

    // User thường chỉ xem được giao dịch của mình
    // Admin và staff có thể xem tất cả
    if (userRole === "admin" || userRole === "staff") {
      if (queryUserId && typeof queryUserId === "string") {
        filter.userId = queryUserId;
      }
    } else if (userId) {
      filter.userId = userId;
    }

    if (status) {
      if (typeof status === "string" && status.includes(",")) {
        filter.status = status.split(",") as any;
      } else {
        filter.status = status as any;
      }
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod as any;
    }

    if (fromDate) {
      filter.fromDate = new Date(fromDate as string);
    }

    if (toDate) {
      filter.toDate = new Date(toDate as string);
    }

    if (minAmount) {
      filter.minAmount = Number(minAmount);
    }

    if (maxAmount) {
      filter.maxAmount = Number(maxAmount);
    }

    // Build options
    const options: GetTransactionsOptions = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      sortBy: (sortBy as string) || "createdAt",
      sortOrder: (sortOrder as "asc" | "desc") || "desc",
    };

    const result = await getTransactions(filter, options);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách giao dịch thành công",
      data: result.transactions,
      pagination: result.pagination,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: "ServerError",
      message: error?.message || "Lỗi khi lấy danh sách giao dịch",
    });
  }
}

/**
 * Lấy lịch sử giao dịch của user hiện tại
 * GET /transactions/my-history
 */
export async function getMyTransactionHistoryController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Chưa đăng nhập",
      });
    }

    const userId = req.user.userId;

    // Query params
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      paymentMethod,
      fromDate,
      toDate,
      minAmount,
      maxAmount,
    } = req.query;

    // Build filter
    const filter: GetTransactionsFilter = {};

    if (userId) {
      filter.userId = userId;
    }

    if (status) {
      if (typeof status === "string" && status.includes(",")) {
        filter.status = status.split(",") as any;
      } else {
        filter.status = status as any;
      }
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod as any;
    }

    if (fromDate) {
      filter.fromDate = new Date(fromDate as string);
    }

    if (toDate) {
      filter.toDate = new Date(toDate as string);
    }

    if (minAmount) {
      filter.minAmount = Number(minAmount);
    }

    if (maxAmount) {
      filter.maxAmount = Number(maxAmount);
    }

    // Build options
    const options: GetTransactionsOptions = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      sortBy: (sortBy as string) || "createdAt",
      sortOrder: (sortOrder as "asc" | "desc") || "desc",
    };

    const result = await getTransactions(filter, options);

    return res.status(200).json({
      success: true,
      message: "Lấy lịch sử giao dịch thành công",
      data: result.transactions,
      pagination: result.pagination,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: "ServerError",
      message: error?.message || "Lỗi khi lấy lịch sử giao dịch",
    });
  }
}

/**
 * Lấy thống kê giao dịch của user hiện tại
 * GET /transactions/my-stats
 */
export async function getMyTransactionStatsController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Chưa đăng nhập",
      });
    }

    const userId = req.user.userId;
    const stats = await getUserTransactionStats(userId);

    return res.status(200).json({
      success: true,
      message: "Lấy thống kê giao dịch thành công",
      data: stats,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: "ServerError",
      message: error?.message || "Lỗi khi lấy thống kê giao dịch",
    });
  }
}

/**
 * Lấy thống kê giao dịch của user bất kỳ (admin/staff only)
 * GET /transactions/stats/:userId
 */
export async function getUserStatsController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "userId là bắt buộc",
      });
    }

    const stats = await getUserTransactionStats(userId);

    return res.status(200).json({
      success: true,
      message: "Lấy thống kê giao dịch thành công",
      data: stats,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi lấy thống kê giao dịch",
    });
  }
}

/**
 * Lấy báo cáo giao dịch chi tiết dạng bảng (admin/staff only)
 * GET /transactions/report
 * Bao gồm: Ngày GD, Tên user, Số tiền, Phương thức, Trạng thái, Lý do thất bại
 */
export async function getTransactionReportController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      paymentMethod,
      fromDate,
      toDate,
      minAmount,
      maxAmount,
      userId: queryUserId,
    } = req.query;

    // Build filter
    const filter: GetTransactionsFilter = {};

    if (queryUserId && typeof queryUserId === "string") {
      filter.userId = queryUserId;
    }

    if (status) {
      if (typeof status === "string" && status.includes(",")) {
        filter.status = status.split(",") as any;
      } else {
        filter.status = status as any;
      }
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod as any;
    }

    if (fromDate) {
      filter.fromDate = new Date(fromDate as string);
    }

    if (toDate) {
      filter.toDate = new Date(toDate as string);
    }

    if (minAmount) {
      filter.minAmount = Number(minAmount);
    }

    if (maxAmount) {
      filter.maxAmount = Number(maxAmount);
    }

    // Build options
    const options: GetTransactionsOptions = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      sortBy: (sortBy as string) || "createdAt",
      sortOrder: (sortOrder as "asc" | "desc") || "desc",
    };

    const result = await getTransactionReport(filter, options);

    return res.status(200).json({
      success: true,
      message: "Lấy báo cáo giao dịch thành công",
      data: result.report,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: "ServerError",
      message: error?.message || "Lỗi khi lấy báo cáo giao dịch",
    });
  }
}

/**
 * Lấy báo cáo giao dịch của user hiện tại
 * GET /transactions/my-report
 */
export async function getMyTransactionReportController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Chưa đăng nhập",
      });
    }

    const userId = req.user.userId;

    const {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      paymentMethod,
      fromDate,
      toDate,
      minAmount,
      maxAmount,
    } = req.query;

    // Build filter
    const filter: GetTransactionsFilter = { userId };

    if (status) {
      if (typeof status === "string" && status.includes(",")) {
        filter.status = status.split(",") as any;
      } else {
        filter.status = status as any;
      }
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod as any;
    }

    if (fromDate) {
      filter.fromDate = new Date(fromDate as string);
    }

    if (toDate) {
      filter.toDate = new Date(toDate as string);
    }

    if (minAmount) {
      filter.minAmount = Number(minAmount);
    }

    if (maxAmount) {
      filter.maxAmount = Number(maxAmount);
    }

    // Build options
    const options: GetTransactionsOptions = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      sortBy: (sortBy as string) || "createdAt",
      sortOrder: (sortOrder as "asc" | "desc") || "desc",
    };

    const result = await getTransactionReport(filter, options);

    return res.status(200).json({
      success: true,
      message: "Lấy báo cáo giao dịch thành công",
      data: result.report,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: "ServerError",
      message: error?.message || "Lỗi khi lấy báo cáo giao dịch",
    });
  }
}
