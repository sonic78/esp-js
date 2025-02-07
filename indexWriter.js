const os = require('os');
const path = require('path');
const fs = require('fs');

const fileExclusions = [
    '.js',
    '.less',
    '.md',
    '.png',
    '.jpg',
    '.json',
    '.xml',
    '.css',
    'webpack.config.js',
    'jest.config.js',
    '.yarnignore',
    'NOTICE',
    'LICENSE',
    '.d.ts',
    '.DS_Store',
    '.html'
];

const directoryExclusions = [
    'tests',
    'typings',
    'dist',
    '.dist',
    'node_modules',
    'css'
];

// At some point a few of these can be auto indexed
const packagesExclusions = [
    'esp-js-di',
    'esp-js-polimer',
    'esp-js-react',
    'esp-js-ui-rxcompat',
    'esp-js-api',
    'esp-js-di-api',
    'esp-js-perf-test',
    'esp-js-react-agile-board',
];

const logger = (message) => {
    console.log(`IndexWriter: ${message}`);
};

const fileSorter = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

const tryRecursivelyWriteIndexFiles = function (directory) {
    if (directoryExclusions.includes(path.basename(directory))) {
        return;
    }
    let files = fs.readdirSync(directory).sort(fileSorter);
    let directoryExports = '';
    let sideEffectImport = '';
    let fileExports = '';
    let newLine = os.platform() === 'win32' ? '\r\n' : '\n';
    files.forEach(function (file) {
        let directory1 = directory + '/' + file;
        if (fs.statSync(directory1).isDirectory()) {
            if (tryRecursivelyWriteIndexFiles(directory1)) {
                if (file.includes('.global')) {
                    sideEffectImport += `import './${file}'; // directory${newLine}`;
                } else {
                    directoryExports += `export * from './${file}';${newLine}`;
                }
            }
        }
        else {
            const baseName = path.basename(file);
            let excludeFile = baseName === 'index.ts' || fileExclusions.some(exclusion => {
                return baseName.toLowerCase().endsWith(exclusion.toLowerCase());
            });
            if (!excludeFile) {
                if (file.includes('.global')) {
                    sideEffectImport += `import './${path.parse(file).name}';${newLine}`;
                } else {
                    fileExports += `export * from './${path.parse(file).name}';${newLine}`;
                }
            }
        }
    });
    let finalOutput = ``;
    if (directoryExports) {
        finalOutput += directoryExports;
    }
    if (sideEffectImport) {
        finalOutput += sideEffectImport;
    }
    if (fileExports) {
        finalOutput += fileExports;
    }

    if (finalOutput === '') {
        finalOutput = 'export { };';
    }

    let blurb = `// Auto-generated ${newLine}`;
    let indexFile = `${directory}/index.ts`;
    finalOutput = `${blurb}${finalOutput}`;
    fs.writeFileSync(indexFile, finalOutput);
    return true;
};

const writeAllIndexFiles = (packagesDirectory) => {
    let directories = fs.readdirSync(packagesDirectory).sort(fileSorter);
    directories.forEach(function (directory) {
        let fullDirectoryPath = `${packagesDirectory}/${directory}`;
        if (!fs.statSync(fullDirectoryPath).isDirectory()) {
            return;
        }
        if (packagesExclusions.includes(path.basename(directory))) {
            return;
        }
        let fullSrcDirectoryPath = `${packagesDirectory}/${directory}/src`;
        if (!fs.statSync(fullSrcDirectoryPath).isDirectory()) {
            return;
        }
        // we jump in one extra level and only write index files for anything under a package-name/src directory
        logger(`Writing all index files under directory ${fullSrcDirectoryPath}`);
        tryRecursivelyWriteIndexFiles(fullSrcDirectoryPath, true);
    });
};

writeAllIndexFiles(path.join(__dirname, 'examples'));
writeAllIndexFiles(path.join(__dirname, 'packages'));
