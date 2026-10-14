const express = require('express');

const router = express.Router();

function normalizeValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

router.get('/query', async (req, res, next) => {
  const appkey = normalizeValue(req.query.appkey);
  const number = normalizeValue(req.query.number);
  const mobile = normalizeValue(req.query.mobile);

  if (!appkey || !number) {
    return res.status(400).json({
      message: 'appkey 和快递单号不能为空。',
    });
  }

  try {
    const searchParams = new URLSearchParams({
      appkey,
      type: 'auto',
      number,
    });

    if (mobile) {
      searchParams.set('mobile', mobile);
    }

    const response = await fetch(`https://api.jisuapi.com/express/query?${searchParams.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.msg || '物流查询失败。',
        details: data,
      });
    }

    if (data?.status !== 0) {
      return res.status(400).json({
        message: data?.msg || '物流查询失败。',
        details: data,
      });
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
