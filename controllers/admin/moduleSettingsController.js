const { DEFAULTS, getModules, saveModules } = require('../../middleware/moduleSettings');

exports.getModuleSettings = async (req, res, next) => {
  try {
    res.render('admin/module-settings', {
      title: 'Module Settings',
      page: 'module-settings',
      user: req.user,
      modules: await getModules(),
      moduleKeys: Object.keys(DEFAULTS)
    });
  } catch (err) {
    next(err);
  }
};

exports.postModuleSettings = async (req, res, next) => {
  try {
    await saveModules(req.body);
    res.redirect('/admin/modules?saved=1');
  } catch (err) {
    next(err);
  }
};
