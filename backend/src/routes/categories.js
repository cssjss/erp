const express = require('express');
const { getPool, query } = require('../config/db');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const categories = await query(
      `SELECT id, name, sort_order, created_at
       FROM categories
       ORDER BY sort_order ASC, created_at DESC, id DESC`,
    );

    if (categories.length === 0) {
      return res.json([]);
    }

    const specs = await query(
      'SELECT id, category_id, name, sort_order FROM category_specs ORDER BY category_id ASC, sort_order ASC, id ASC',
    );

    const specMap = new Map();
    specs.forEach((spec) => {
      const current = specMap.get(spec.category_id) || [];
      current.push({
        id: spec.id,
        name: spec.name,
        sortOrder: spec.sort_order,
      });
      specMap.set(spec.category_id, current);
    });

    const data = categories.map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sort_order,
      createdAt: category.created_at,
      specs: specMap.get(category.id) || [],
    }));

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const { name, specs } = req.body;
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const normalizedSpecs = Array.isArray(specs)
    ? specs
        .map((spec) => (typeof spec === 'string' ? spec.trim() : ''))
        .filter(Boolean)
    : [];

  if (!trimmedName) {
    return res.status(400).json({ message: '一级分类不能为空。' });
  }

  if (normalizedSpecs.length === 0) {
    return res.status(400).json({ message: '至少需要一个子规格。' });
  }

  const uniqueSpecs = [...new Set(normalizedSpecs)];
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const [sortRows] = await connection.execute(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order FROM categories',
    );
    const sortOrder = Number(sortRows[0]?.max_sort_order || 0) + 1;

    const [categoryResult] = await connection.execute(
      'INSERT INTO categories (name, sort_order) VALUES (?, ?)',
      [trimmedName, sortOrder],
    );

    const categoryId = categoryResult.insertId;
    const specValues = uniqueSpecs.map((specName, index) => [categoryId, specName, index + 1]);

    await connection.query(
      'INSERT INTO category_specs (category_id, name, sort_order) VALUES ?',
      [specValues],
    );

    const [createdSpecs] = await connection.execute(
      'SELECT id, name, sort_order FROM category_specs WHERE category_id = ? ORDER BY sort_order ASC, id ASC',
      [categoryId],
    );

    await connection.commit();

    res.status(201).json({
      id: categoryId,
      name: trimmedName,
      sortOrder,
      specs: createdSpecs.map((spec) => ({
        id: spec.id,
        name: spec.name,
        sortOrder: spec.sort_order,
      })),
    });
  } catch (error) {
    await connection.rollback();

    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: '该一级分类或子规格已存在。' });
    }

    next(error);
  } finally {
    connection.release();
  }
});

router.put('/reorder', async (req, res, next) => {
  const categoryIds = Array.isArray(req.body.categoryIds)
    ? req.body.categoryIds.map((id) => Number(id))
    : [];
  const uniqueIds = [...new Set(categoryIds)];

  if (
    categoryIds.length === 0 ||
    uniqueIds.length !== categoryIds.length ||
    categoryIds.some((id) => !Number.isInteger(id) || id <= 0)
  ) {
    return res.status(400).json({ message: '分类排序参数无效。' });
  }

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.execute(
      'SELECT id FROM categories ORDER BY id ASC FOR UPDATE',
    );
    const existingIds = existingRows.map((row) => Number(row.id)).sort((a, b) => a - b);
    const submittedIds = [...categoryIds].sort((a, b) => a - b);

    if (
      existingIds.length !== submittedIds.length ||
      existingIds.some((id, index) => id !== submittedIds[index])
    ) {
      await connection.rollback();
      return res.status(409).json({ message: '分类数据已发生变化，请刷新后重新排序。' });
    }

    for (const [index, categoryId] of categoryIds.entries()) {
      await connection.execute(
        'UPDATE categories SET sort_order = ? WHERE id = ?',
        [index + 1, categoryId],
      );
    }

    await connection.commit();
    res.json({ categoryIds });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.delete('/:id', async (req, res, next) => {
  const categoryId = Number(req.params.id);

  if (!Number.isInteger(categoryId)) {
    return res.status(400).json({ message: '分类参数无效。' });
  }

  try {
    const result = await query('DELETE FROM categories WHERE id = ?', [categoryId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '分类不存在。' });
    }

    res.json({ id: categoryId, deleted: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
