// Download Mard bead CSV and generate JSON palette files
const https = require('https');
const fs = require('fs');
const path = require('path');

// 安全保护：此脚本会覆盖 engine/palettes/mard_all.json。
// 当前 mard_all.json 是 2026-08-14 人工修正的 v4.1 数据，第三方源可能仍含错误，
// 因此默认拒绝执行；确需重跑时先备份，再显式传 --overwrite-corrected-data。
if (!process.argv.includes('--overwrite-corrected-data')) {
  console.error('已停用：该脚本可能覆盖人工修正的 mard_all.json v4.1 色卡。');
  console.error('如确需重跑，请先备份 engine/palettes/mard_all.json，再传 --overwrite-corrected-data。');
  process.exit(1);
}

https.get('https://beadcolors.eremes.xyz/raw/mard.csv', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const lines = data.trim().split('\n').filter(l => /^[A-Z]/.test(l));
    const colors = [];
    lines.forEach(line => {
      const parts = line.split(',');
      const code = parts[0].trim();
      const r = parseInt(parts[2]), g = parseInt(parts[3]), b = parseInt(parts[4]);
      const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0').toUpperCase()).join('');
      const series = code.replace(/[0-9]/g, '');
      const num = parseInt(code.replace(/[A-Z]+/g, ''));
      colors.push({ code, series, num, hex, r, g, b });
    });

    // Sort by series letter then number
    colors.sort((a, b) => a.series.localeCompare(b.series) || a.num - b.num);
    console.log('Downloaded: ' + colors.length + ' Mard colors');

    // Color naming from RGB
    function colorName(r, g, b) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const rf = r / 255, gf = g / 255, bf = b / 255;
      const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
      const s = max === 0 ? 0 : (max - min) / max;
      let h = 0;
      if (max !== min) {
        if (max === rf) h = 60 * (((gf - bf) / (max - min)) % 6);
        else if (max === gf) h = 60 * (((bf - rf) / (max - min)) + 2);
        else h = 60 * (((rf - gf) / (max - min)) + 4);
      }
      if (h < 0) h += 360;
      const bri = (r + g + b) / 3;

      if (s < 0.08) {
        if (lum > 230) return 'White';
        if (lum > 190) return 'Off White';
        if (lum > 150) return 'Light Grey';
        if (lum > 100) return 'Grey';
        if (lum > 60) return 'Dark Grey';
        return 'Black';
      }

      let prefix = '';
      if (bri > 220) prefix = 'Pale ';
      else if (bri > 180) prefix = 'Light ';
      else if (bri < 50) prefix = 'Dark ';
      else if (bri < 90) prefix = 'Deep ';

      let name;
      if (h < 15 || h >= 345) name = 'Red';
      else if (h < 35) name = 'Orange';
      else if (h < 55) name = 'Yellow';
      else if (h < 85) name = 'Lime';
      else if (h < 150) name = 'Green';
      else if (h < 195) name = 'Cyan';
      else if (h < 260) name = 'Blue';
      else if (h < 290) name = 'Purple';
      else if (h < 330) name = 'Magenta';
      else name = 'Pink';

      return prefix + name;
    }

    // Build JSON
    const entries = colors.map(c =>
      '    {"name": ' + JSON.stringify(colorName(c.r, c.g, c.b)) +
      ', "code": ' + JSON.stringify(c.code) +
      ', "hex": ' + JSON.stringify(c.hex) + '}'
    );

    const json = '{\n' +
      '  "brand": "Mard (291 Colors)",\n' +
      '  "version": "3.0",\n' +
      '  "description": "Complete Mard bead color library — 291 official colors (A-ZG series). Data source: pixel-beads.com / beadcolors project.",\n' +
      '  "colors": [\n' + entries.join(',\n') + '\n  ]\n' +
      '}\n';

    const outDir = path.resolve(__dirname, '..', 'engine', 'palettes');
    fs.writeFileSync(path.join(outDir, 'mard_all.json'), json, 'utf8');
    console.log('Written: mard_all.json (' + colors.length + ' colors)');

    // Sample output
    console.log('\nSample entries:');
    [0, 1, 2, 29, 30, 31, 57, 58, 200, 288, 289, 290].forEach(i => {
      if (colors[i]) {
        const c = colors[i];
        console.log('  ' + c.code + ': ' + colorName(c.r, c.g, c.b) + ' (' + c.hex + ')');
      }
    });

    // Series summary
    const seriesMap = {};
    colors.forEach(c => {
      seriesMap[c.series] = (seriesMap[c.series] || 0) + 1;
    });
    console.log('\nSeries breakdown:');
    Object.keys(seriesMap).sort().forEach(s => {
      console.log('  ' + s + ': ' + seriesMap[s] + ' colors');
    });
  });
}).on('error', e => console.error('Download failed:', e.message));
