const express = require('express');
const router = express.Router();
const controller = require('../controllers/facilitiesController');

router.get('/', controller.list);
router.get('/catalog', controller.catalog);
router.get('/check-name', controller.checkName);
router.get('/check-email', controller.checkEmail);
router.get('/check-phone', controller.checkPhone);
router.post('/:id/reset-password', controller.resetPassword);
router.post('/:id/verify-password', controller.verifyPassword);
router.post('/send-password-email', controller.sendPasswordEmail);
router.post('/', controller.create);
router.post('/login', controller.login);
router.get('/:id', controller.get);
router.put('/:id', controller.update);
// record a view for analytics
router.post('/:id/view', controller.recordView);
// submit a rating for facility
router.post('/:id/rate', controller.rate);

module.exports = router;
