const ts = require('typescript');
module.exports = {
  process(src, filename) {
    return ts.transpileModule(src, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        inlineSourceMap: true,
        inlineSources: true,
      },
      fileName: filename,
    }).outputText;
  },
};
