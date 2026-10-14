const express = require('express');
const { getPool, query } = require('../config/db');

const router = express.Router();
const STATUS_OPTIONS = ['待寄回', '已寄回', '已到货', '已发出', '已完成'];

function normalizeQuantity(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function normalizePrice(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed * 100) / 100;
}

function normalizeProductIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item)))];
}

function normalizeSpecValues(specValues) {
  if (!specValues || typeof specValues !== 'object') {
    return {};
  }

  return Object.entries(specValues).reduce((acc, [key, value]) => {
    const specId = Number(key);

    if (!Number.isInteger(specId)) {
      return acc;
    }

    acc[specId] = typeof value === 'string' ? value.trim() : '';
    return acc;
  }, {});
}

async function getCategorySpecs(categoryId) {
  return query(
    'SELECT id, category_id, name, sort_order FROM category_specs WHERE category_id = ? ORDER BY sort_order ASC, id ASC',
    [categoryId],
  );
}

function shapeProductRows(rows) {
  const productMap = new Map();

  rows.forEach((row) => {
    if (!productMap.has(row.id)) {
      productMap.set(row.id, {
        id: row.id,
        categoryId: row.category_id,
        parentProductId: row.parent_product_id,
        sortOrder: row.sort_order,
        price: Number(row.price || 0),
        quantity: row.quantity,
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        specValues: {},
      });
    }

    if (row.spec_id) {
      productMap.get(row.id).specValues[row.spec_id] = row.value || '';
    }
  });

  return Array.from(productMap.values());
}

async function getNextSortOrder(connection, categoryId, parentProductId = null) {
  const [rows] = await connection.execute(
    `SELECT COALESCE(MAX(sort_order), 0) AS maxSortOrder
     FROM products
     WHERE category_id = ? AND ${parentProductId === null ? 'parent_product_id IS NULL' : 'parent_product_id = ?'}`,
    parentProductId === null ? [categoryId] : [categoryId, parentProductId],
  );

  return Number(rows[0]?.maxSortOrder || 0) + 1;
}

async function ensureParentProduct(connection, categoryId, parentProductId) {
  if (parentProductId === null) {
    return true;
  }

  const [rows] = await connection.execute(
    'SELECT id FROM products WHERE id = ? AND category_id = ? AND parent_product_id IS NULL',
    [parentProductId, categoryId],
  );

  return rows.length > 0;
}

async function normalizeCategorySortOrders(connection, categoryId) {
  const [rows] = await connection.execute(
    `SELECT id, parent_product_id, sort_order
     FROM products
     WHERE category_id = ?
     ORDER BY
       CASE WHEN parent_product_id IS NULL THEN 0 ELSE 1 END ASC,
       parent_product_id ASC,
       sort_order ASC,
       id ASC`,
    [categoryId],
  );

  const updates = [];
  const counters = new Map();

  for (const row of rows) {
    const key = row.parent_product_id === null ? 'root' : `child:${row.parent_product_id}`;
    const nextSortOrder = (counters.get(key) || 0) + 1;
    counters.set(key, nextSortOrder);

    if (Number(row.sort_order) !== nextSortOrder) {
      updates.push([nextSortOrder, row.id]);
    }
  }

  for (const [sortOrder, productId] of updates) {
    await connection.execute('UPDATE products SET sort_order = ? WHERE id = ?', [sortOrder, productId]);
  }
}

router.get('/', async (req, res, next) => {
  const categoryId = Number(req.query.categoryId);

  if (!Number.isInteger(categoryId)) {
    return res.status(400).json({ message: 'categoryId 参数无效。' });
  }

  try {
    const connection = await getPool().getConnection();
    try {
      await normalizeCategorySortOrders(connection, categoryId);

      const [rows] = await connection.execute(
        `SELECT
          p.id,
          p.category_id,
          p.parent_product_id,
          p.sort_order,
          p.price,
          p.quantity,
          p.status,
          p.note,
          p.created_at,
          p.updated_at,
          psv.spec_id,
          psv.value
        FROM products p
        LEFT JOIN products parent ON parent.id = p.parent_product_id
        LEFT JOIN product_spec_values psv ON p.id = psv.product_id
        WHERE p.category_id = ?
        ORDER BY
          COALESCE(parent.sort_order, p.sort_order) ASC,
          CASE WHEN p.parent_product_id IS NULL THEN 0 ELSE 1 END ASC,
          p.sort_order ASC,
          COALESCE(parent.id, p.id) ASC,
          p.id ASC,
          psv.spec_id ASC`,
        [categoryId],
      );

      res.json(shapeProductRows(rows));
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const categoryId = Number(req.body.categoryId);
  const parentProductId =
    req.body.parentProductId === null || req.body.parentProductId === undefined
      ? null
      : Number(req.body.parentProductId);
  const quantity = normalizeQuantity(req.body.quantity);
  const price = normalizePrice(req.body.price);
  const status = STATUS_OPTIONS.includes(req.body.status) ? req.body.status : '待寄回';
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  const specValues = normalizeSpecValues(req.body.specValues);

  if (!Number.isInteger(categoryId) || (parentProductId !== null && !Number.isInteger(parentProductId))) {
    return res.status(400).json({ message: '分类无效。' });
  }

  const connection = await getPool().getConnection();

  try {
    const specs = await getCategorySpecs(categoryId);

    if (specs.length === 0) {
      return res.status(400).json({ message: '该分类还没有配置规格。' });
    }

    await connection.beginTransaction();
    await normalizeCategorySortOrders(connection, categoryId);

    const parentIsValid = await ensureParentProduct(connection, categoryId, parentProductId);

    if (!parentIsValid) {
      await connection.rollback();
      return res.status(400).json({ message: '父级产品无效。' });
    }

    const sortOrder = await getNextSortOrder(connection, categoryId, parentProductId);

    const [productResult] = await connection.execute(
      'INSERT INTO products (category_id, parent_product_id, sort_order, price, quantity, status, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [categoryId, parentProductId, sortOrder, price, quantity, status, note],
    );

    const productId = productResult.insertId;
    const specRows = specs.map((spec) => [productId, spec.id, specValues[spec.id] || '']);

    await connection.query(
      'INSERT INTO product_spec_values (product_id, spec_id, value) VALUES ?',
      [specRows],
    );

    await connection.commit();

    res.status(201).json({
      id: productId,
      categoryId,
      parentProductId,
      sortOrder,
      price,
      quantity,
      status,
      note,
      specValues,
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.put('/:id', async (req, res, next) => {
  const productId = Number(req.params.id);
  const categoryId = Number(req.body.categoryId);
  const parentProductId =
    req.body.parentProductId === null || req.body.parentProductId === undefined
      ? null
      : Number(req.body.parentProductId);
  const quantity = normalizeQuantity(req.body.quantity);
  const price = normalizePrice(req.body.price);
  const status = STATUS_OPTIONS.includes(req.body.status) ? req.body.status : '待寄回';
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  const specValues = normalizeSpecValues(req.body.specValues);

  if (
    !Number.isInteger(productId) ||
    !Number.isInteger(categoryId) ||
    (parentProductId !== null && !Number.isInteger(parentProductId))
  ) {
    return res.status(400).json({ message: '产品或分类无效。' });
  }

  const connection = await getPool().getConnection();

  try {
    const specs = await getCategorySpecs(categoryId);

    if (specs.length === 0) {
      return res.status(400).json({ message: '该分类还没有配置规格。' });
    }

    await connection.beginTransaction();
    await normalizeCategorySortOrders(connection, categoryId);

    if (parentProductId === productId) {
      await connection.rollback();
      return res.status(400).json({ message: '产品不能作为自己的父级。' });
    }

    const parentIsValid = await ensureParentProduct(connection, categoryId, parentProductId);

    if (!parentIsValid) {
      await connection.rollback();
      return res.status(400).json({ message: '父级产品无效。' });
    }

    await connection.execute(
      'UPDATE products SET parent_product_id = ?, price = ?, quantity = ?, status = ?, note = ? WHERE id = ? AND category_id = ?',
      [parentProductId, price, quantity, status, note, productId, categoryId],
    );

    for (const spec of specs) {
      await connection.execute(
        `INSERT INTO product_spec_values (product_id, spec_id, value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value)`,
        [productId, spec.id, specValues[spec.id] || ''],
      );
    }

    await connection.commit();

    res.json({
      id: productId,
      categoryId,
      parentProductId,
      price,
      quantity,
      status,
      note,
      specValues,
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.patch('/batch/status', async (req, res, next) => {
  const productIds = normalizeProductIds(req.body.productIds);
  const status = req.body.status;

  if (productIds.length === 0 || !STATUS_OPTIONS.includes(status)) {
    return res.status(400).json({ message: '批量状态更新参数无效。' });
  }

  try {
    const placeholders = productIds.map(() => '?').join(', ');
    const result = await query(
      `UPDATE products SET status = ? WHERE id IN (${placeholders})`,
      [status, ...productIds],
    );

    res.json({ updated: result.affectedRows, productIds, status });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  const productId = Number(req.params.id);
  const status = req.body.status;

  if (!Number.isInteger(productId) || !STATUS_OPTIONS.includes(status)) {
    return res.status(400).json({ message: '状态更新参数无效。' });
  }

  try {
    await query('UPDATE products SET status = ? WHERE id = ?', [status, productId]);
    res.json({ id: productId, status });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/move', async (req, res, next) => {
  const productId = Number(req.params.id);
  const direction = req.body.direction;

  if (!Number.isInteger(productId) || !['up', 'down'].includes(direction)) {
    return res.status(400).json({ message: '排序参数无效。' });
  }

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const [productRows] = await connection.execute(
      'SELECT id, category_id, parent_product_id, sort_order FROM products WHERE id = ? AND parent_product_id IS NULL',
      [productId],
    );

    const currentProduct = productRows[0];

    if (!currentProduct) {
      await connection.rollback();
      return res.status(404).json({ message: '父级产品不存在。' });
    }

    await normalizeCategorySortOrders(connection, currentProduct.category_id);

    const [freshRows] = await connection.execute(
      'SELECT id, category_id, parent_product_id, sort_order FROM products WHERE id = ? AND parent_product_id IS NULL',
      [productId],
    );
    const normalizedProduct = freshRows[0];

    const comparator = direction === 'up' ? '<' : '>';
    const order = direction === 'up' ? 'DESC' : 'ASC';

    const [siblingRows] = await connection.execute(
      `SELECT id, sort_order
       FROM products
       WHERE category_id = ? AND parent_product_id IS NULL AND sort_order ${comparator} ?
       ORDER BY sort_order ${order}
       LIMIT 1`,
      [normalizedProduct.category_id, normalizedProduct.sort_order],
    );

    const sibling = siblingRows[0];

    if (!sibling) {
      await connection.rollback();
      return res.json({ moved: false });
    }

    await connection.execute('UPDATE products SET sort_order = ? WHERE id = ?', [
      sibling.sort_order,
      normalizedProduct.id,
    ]);
    await connection.execute('UPDATE products SET sort_order = ? WHERE id = ?', [
      normalizedProduct.sort_order,
      sibling.id,
    ]);

    await connection.commit();
    res.json({ moved: true });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.post('/batch-delete', async (req, res, next) => {
  const productIds = normalizeProductIds(req.body.productIds);

  if (productIds.length === 0) {
    return res.status(400).json({ message: '批量删除参数无效。' });
  }

  try {
    const placeholders = productIds.map(() => '?').join(', ');
    const result = await query(
      `DELETE FROM products WHERE id IN (${placeholders})`,
      productIds,
    );

    res.json({ deleted: result.affectedRows, productIds });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  const productId = Number(req.params.id);

  if (!Number.isInteger(productId)) {
    return res.status(400).json({ message: '产品参数无效。' });
  }

  try {
    const result = await query('DELETE FROM products WHERE id = ?', [productId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '产品不存在。' });
    }

    res.json({ id: productId, deleted: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
