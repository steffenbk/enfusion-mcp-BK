// Quick standalone test for GUID indexing
import { PakVirtualFS } from './dist/pak/vfs.js';

const gamePath = process.env.ENFUSION_GAME_PATH || 'G:/SteamLibrary/steamapps/common/Arma Reforger';
console.log('gamePath:', gamePath);

const vfs = PakVirtualFS.get(gamePath);
if (!vfs) {
  console.error('VFS is null — game path not found or no pak files');
  process.exit(1);
}

console.log('VFS ok, total files:', vfs.fileCount);

const allPaths = vfs.allFilePaths();
const catalogs = allPaths.filter(p => p.toLowerCase().includes('entitycatalog') && p.toLowerCase().endsWith('.conf'));
console.log('Catalog count:', catalogs.length);
console.log('First 3:', catalogs.slice(0, 3));

if (catalogs.length > 0) {
  const sample = catalogs[0];
  console.log('\nReading:', sample);
  const content = vfs.readTextFile(sample);
  const GUID_PATTERN = /\{([0-9A-Fa-f]{16})\}([^\s"]+\.et)/g;
  let match, count = 0;
  while ((match = GUID_PATTERN.exec(content)) !== null) count++;
  console.log('GUIDs found in first catalog:', count);
}
