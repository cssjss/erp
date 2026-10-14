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

router.get('/', async (req, res, next) => {
  const dateFrom = normalizeDate(req.query.dateFrom);
  const dateTo = normalizeDate(req.query.dateTo);
  const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';

  const conditions = [];
  const params = [];

  if (dateFrom) {
    conditions.push('loss_date >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push('loss_date <= ?');
    params.push(dateTo);
  }

  if (keyword) {
    conditions.push('(reason LIKE ? OR note LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const rows = await query(
      `SELECT
        id,
        reason,
        loss_amount,
        shipping_loss,
        other_loss,
        note,
        loss_date,
        created_at,
        updated_at
      FROM loss_records
      ${whereClause}
      ORDER BY loss_date DESC, id DESC`,
      params,
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        reason: row.reason,
        lossAmount: Number(row.loss_amount),
        shippingLoss: Number(row.shipping_loss),
        otherLoss: Number(row.other_loss),
        note: row.note,
        lossDate: formatDateOnly(row.loss_date),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    );
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  const lossAmount = normalizeAmount(req.body.lossAmount);
  const shippingLoss = normalizeAmount(req.body.shippingLoss);
  const otherLoss = normalizeAmount(req.body.otherLoss);
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  const lossDate = normalizeDate(req.body.lossDate);

  if (!reason || !lossDate) {
    return res.status(400).json({ message: '亏损原因和亏损日期不能为空。' });
  }

  try {
    const result = await query(
      `INSERT INTO loss_records (reason, loss_amount, shipping_loss, other_loss, note, loss_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [reason, lossAmount, shippingLoss, otherLoss, note, lossDate],
    );

    res.status(201).json({
      id: result.insertId,
      reason,
      lossAmount,
      shippingLoss,
      otherLoss,
      note,
      lossDate,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  const recordId = Number(req.params.id);
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  const lossAmount = normalizeAmount(req.body.lossAmount);
  const shippingLoss = normalizeAmount(req.body.shippingLoss);
  const otherLoss = normalizeAmount(req.body.otherLoss);
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  const lossDate = normalizeDate(req.body.lossDate);

  if (!Number.isInteger(recordId) || !reason || !lossDate) {
    return res.status(400).json({ message: '亏损记录参数无效。' });
  }

  try {
    const result = await query(
      `UPDATE loss_records
       SET reason = ?, loss_amount = ?, shipping_loss = ?, other_loss = ?, note = ?, loss_date = ?
       WHERE id = ?`,
      [reason, lossAmount, shippingLoss, otherLoss, note, lossDate, recordId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '亏损记录不存在。' });
    }

    res.json({
      id: recordId,
      reason,
      lossAmount,
      shippingLoss,
      otherLoss,
      note,
      lossDate,
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
      `DELETE FROM loss_records WHERE id IN (${placeholders})`,
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
    return res.status(400).json({ message: '亏损记录参数无效。' });
  }

  try {
    const result = await query('DELETE FROM loss_records WHERE id = ?', [recordId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '亏损记录不存在。' });
    }

    res.json({ id: recordId, deleted: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
