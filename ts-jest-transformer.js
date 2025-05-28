const ts = require('typescript');
module.exports = {
  process(src, filename) {
    return ts.transpileModule(src, {
      compilerOptions: { module: 'commonjs', jsx: 'react' },
      fileName: filename,
    }).outputText;
  },
};
