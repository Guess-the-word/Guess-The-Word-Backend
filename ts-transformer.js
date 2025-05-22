const ts = require('typescript');
module.exports = {
  process(src, filename) {
    if (filename.endsWith('.ts')) {
      const result = ts.transpileModule(src, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          esModuleInterop: true,
          target: ts.ScriptTarget.ES2019,
        },
        fileName: filename,
      });
      return result.outputText;
    }
    return src;
  },
};
