const express = require('express');
const { query } = require('../config/db');

const router = express.Router();

function normalizeAmount(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Number(parsed.toFixed(2));
}

function normalizeIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item)))];
}

function normalizeDate(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function formatDateOnly(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function calculateGrossProfit(actualRevenue, actualCost) {
  const grossProfit = Number((actualRevenue - actualCost).toFixed(2));
  const rate = actualRevenue === 0 ? 0 : Number((((actualRevenue - actualCost) / actualRevenue) * 100).toFixed(2));

  return {
    grossProfit,
    rate,
  };
}

router.get('/', async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT
        id,
        actual_revenue,
        actual_cost,
        actual_gross_profit,
        gross_profit_rate,
        record_date,
        note,
        created_at,
        updated_at
      FROM gross_profit_records
      ORDER BY record_date DESC, id DESC`,
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        actualRevenue: Number(row.actual_revenue),
        actualCost: Number(row.actual_cost),
        actualGrossProfit: Number(row.actual_gross_profit),
        grossProfitRate: Number(row.gross_profit_rate),
        recordDate: formatDateOnly(row.record_date),
        note: row.note || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    );
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const actualRevenue = normalizeAmount(req.body.actualRevenue);
  const actualCost = normalizeAmount(req.body.actualCost);
  const recordDate = normalizeDate(req.body.recordDate);
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';

  if (!recordDate) {
    return res.status(400).json({ message: '日期不能为空。' });
  }

  const { grossProfit, rate } = calculateGrossProfit(actualRevenue, actualCost);

  try {
    const result = await query(
      `INSERT INTO gross_profit_records (
        actual_revenue,
        actual_cost,
        actual_gross_profit,
        gross_profit_rate,
        record_date,
        note
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [actualRevenue, actualCost, grossProfit, rate, recordDate, note],
    );

    res.status(201).json({
      id: result.insertId,
      actualRevenue,
      actualCost,
      actualGrossProfit: grossProfit,
      grossProfitRate: rate,
      recordDate,
      note,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  const recordId = Number(req.params.id);
  const actualRevenue = normalizeAmount(req.body.actualRevenue);
  const actualCost = normalizeAmount(req.body.actualCost);
  const recordDate = normalizeDate(req.body.recordDate);
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';

  if (!Number.isInteger(recordId) || !recordDate) {
    return res.status(400).json({ message: '毛利记录参数无效。' });
  }

  const { grossProfit, rate } = calculateGrossProfit(actualRevenue, actualCost);

  try {
    const result = await query(
      `UPDATE gross_profit_records
       SET actual_revenue = ?, actual_cost = ?, actual_gross_profit = ?, gross_profit_rate = ?, record_date = ?, note = ?
       WHERE id = ?`,
      [actualRevenue, actualCost, grossProfit, rate, recordDate, note, recordId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '毛利记录不存在。' });
    }

    res.json({
      id: recordId,
      actualRevenue,
      actualCost,
      actualGrossProfit: grossProfit,
      grossProfitRate: rate,
      recordDate,
      note,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/batch-delete', async (req, res, next) => {
  const recordIds = normalizeIds(req.body.recordIds);

  if (recordIds.length === 0) {
    return res.status(400).json({ message: '批量删除参数无效。' });
  }

  try {
    const placeholders = recordIds.map(() => '?').join(', ');
    const result = await query(
      `DELETE FROM gross_profit_records WHERE id IN (${placeholders})`,
      recordIds,
    );

    res.json({ deleted: result.affectedRows, recordIds });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  const recordId = Number(req.params.id);

  if (!Number.isInteger(recordId)) {
    return res.status(400).json({ message: '毛利记录参数无效。' });
  }

  try {
    const result = await query('DELETE FROM gross_profit_records WHERE id = ?', [recordId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '毛利记录不存在。' });
    }

    res.json({ id: recordId, deleted: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
