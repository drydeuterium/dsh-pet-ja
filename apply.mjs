#!/usr/bin/env node
/**
 * dsh-pet-ja —— DSH のプラグイン「dsh-pet」を日本語化するローカルパッチ
 *
 * やること:
 *   1) 日本語フォント（既定: fonts/Nikumaru.ttf = にくまるフォント）をプラグインへ配置し、
 *      @font-face の参照をそれに向ける（ブラウザ半側・デスクトップ半側の両方）
 *   2) 右クリックメニューの直書き中国語を日本語に置換
 *      （アニメ名は素材ファイル名なので、表示ラベルだけ別表で差し替える）
 *   3) 設定ページ用の ja 辞書を DSH の locale サービスへ言語パックとして登録
 *   4) 通知・残高バブル・チャット窓・DSH コマンド説明など、コード直書きの中国語 UI 文言を日本語化
 *   5) LLM への指示文・時刻コンテキスト（ホスト半側）を日本語化
 *   6) 「desktop 表示のペットがいない」ときにデスクトップへ赤いエラー帯を出さない／
 *      その状態ではデスクトップヘルパーを再起動しない
 *
 * 使い方:
 *   node apply.mjs [--profile <name>] [--font <path>] [--pkg <dir>] [--dry-run] [--install-config]
 *
 *   --profile <name>  ~/.dsh/profiles/<name>/node_modules/dsh-pet を対象にする
 *                     （省略時は dsh-pet が入っている全プロファイルを自動検出）
 *   --font <path>     使うフォントファイル（.ttf 推奨）。省略時は fonts/Nikumaru.ttf
 *   --pkg <dir>       プラグインディレクトリを直接指定（テスト・特殊な配置向け）
 *   --dry-run         変更内容の確認だけ（ファイルは書き換えない）
 *   --install-config  日本語のサンプル設定を ~/.dsh/dsh-pet/main-config.jsonc へコピー
 *                     （既にファイルがある場合は何もしない）
 *
 * 注意:
 *   - node_modules の中身を直接書き換える。プラグインを入れ直す／更新すると元に戻るので、
 *     その場合はこのスクリプトをもう一度実行する（何度実行しても安全＝冪等）。
 *   - 反映: ブラウザ半側はページ再読み込み。ホスト半側（lib/index.js）は
 *     プロファイルの再構成か DSH の再起動で読み込まれる。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};

const dryRun = flag('dry-run');
const wantConfig = flag('install-config');
const profileArg = value('profile', undefined);
const pkgArg = value('pkg', undefined);

/** 動作確認済みの dsh-pet バージョン（これ以外では文字列が一致しない可能性がある） */
const TESTED_VERSION = '0.3.7';

const dataDir = join(here, 'data');
const fontSource = resolve(value('font', join(here, 'fonts', 'Nikumaru.ttf')));
const sampleConfig = join(here, 'config', 'main-config.ja.jsonc');
const userConfigPath = join(homedir(), '.dsh', 'dsh-pet', 'main-config.jsonc');

const animJa = readJson(join(dataDir, 'anim-ja.json'));
const litJa = readJson(join(dataDir, 'lit-ja.json'));
const hostJa = readJson(join(dataDir, 'host-ja.json'));
const dictJa = readJson(join(dataDir, 'dict-ja.json'));

/** ホスト半側の表（字下げや末尾カンマの揺れに強いよう、ブロックごと差し替える） */
const HOST_BLOCKS = [
  {
    what: 'WEEKDAYS',
    re: /const WEEKDAYS = \[[\s\S]*?\];/,
    out: 'const WEEKDAYS = [\n\t"日曜日",\n\t"月曜日",\n\t"火曜日",\n\t"水曜日",\n\t"木曜日",\n\t"金曜日",\n\t"土曜日"\n];',
  },
  {
    what: 'SLOTS',
    re: /const SLOTS = \[[\s\S]*?\];/,
    out: 'const SLOTS = [\n\t[23, "深夜"],\n\t[19, "夜"],\n\t[17, "夕方"],\n\t[13, "午後"],\n\t[11, "昼"],\n\t[9, "午前"],\n\t[7, "朝"],\n\t[5, "早朝"],\n\t[0, "未明"]\n];',
  },
];

/** メニューの分類ラベル（プラグイン側の animations.categories[].id に対応） */
const CATEGORY_JA = { 小动作: '小ワザ', 玩耍: '遊び', 吃什么: '食べもの', 时节: '季節行事', 文字: '文字もの' };

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`必要なデータを読めない: ${path}\n${e.message}`);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/* 対象プラグインの解決                                                */
/* ------------------------------------------------------------------ */
function resolveTargets() {
  if (pkgArg) return [{ label: pkgArg, dir: resolve(pkgArg) }];
  const profilesRoot = join(homedir(), '.dsh', 'profiles');
  const names = profileArg
    ? [profileArg]
    : existsSync(profilesRoot)
      ? readdirSync(profilesRoot).filter((n) => existsSync(join(profilesRoot, n, 'node_modules', 'dsh-pet')))
      : [];
  if (names.length === 0) {
    console.error('dsh-pet が見つからない。--profile <name> か --pkg <dir> で指定してほしい。');
    process.exit(1);
  }
  return names.map((n) => ({
    label: `profile "${n}"`,
    dir: join(profilesRoot, n, 'node_modules', 'dsh-pet'),
  }));
}

/* ------------------------------------------------------------------ */
/* 置換ヘルパ                                                          */
/* ------------------------------------------------------------------ */
const esc = (s) => JSON.stringify(s);
const jsObject = (obj, indent = '\t') =>
  '{\n' + Object.entries(obj).map(([k, v]) => `${indent}${esc(k)}: ${esc(v)}`).join(',\n') + '\n}';

/** 文字列置換。置換できなかった項目は missing に、既に入っている項目は applied に積んで後で報告する */
function applyLiterals(text, pairs, label, log, missing, applied, fileLabel = '') {
  const where = fileLabel ? `${fileLabel} ${label}` : label;
  let out = text;
  for (const [from, to] of pairs) {
    // 先に「適用済みか」を見る。from が to の先頭部分になっている置換（挿入系）で
    // 二重挿入しないための順序。
    if (to && out.includes(to)) {
      applied.push(`${where}: ${from.slice(0, 48).replace(/\n/g, '\\n')}`);
      continue;
    }
    if (!out.includes(from)) {
      missing.push(`${where}: ${from.slice(0, 60).replace(/\n/g, '\\n')}`);
      continue;
    }
    const n = out.split(from).length - 1;
    out = out.split(from).join(to);
    log.push(`${label}: ${n}× ${from.slice(0, 48).replace(/\n/g, '\\n')}`);
  }
  return out;
}

/** @font-face / フォント URL をフォント名に合わせる（何度実行しても同じ結果になる） */
function patchFontUrls(text, fontName) {
  let out = text;
  let n = 0;
  // CSS 文字列（\" でエスケープされている場合もある）中のフォントパスだけを差し替える
  out = out.replace(/\/dsh-pet-7340\/font\/[^"'\\)]+/g, () => {
    n += 1;
    return `/dsh-pet-7340/font/${fontName}`;
  });
  // デスクトップ側は '/font/' + encodeURIComponent('上首软糖体') + '.ttf"...' のように組み立てている
  out = out.replace(
    /'\/font\/'\s*\+\s*(?:encodeURIComponent\('[^']*'\)|'[^']*')\s*\+\s*'\.ttf/g,
    () => {
      n += 1;
      return `'/font/' + ${JSON.stringify(fontName)} + '`;
    },
  );
  return { text: out, count: n };
}

/* ------------------------------------------------------------------ */
/* 本体                                                                */
/* ------------------------------------------------------------------ */
const report = [];
const missing = [];
const applied = [];
const touched = [];
let changedFiles = 0;

const hasFont = existsSync(fontSource);
const fontName = hasFont ? basename(fontSource) : undefined;
if (!hasFont) {
  report.push(`font: 見つからない（${fontSource}）→ フォント差し替えはスキップして文言だけ適用する`);
  report.push('      --font <path/to/font.ttf> で指定できる（README の「フォントを変える」参照）');
}

for (const target of resolveTargets()) {
  const pkgRoot = target.dir;
  report.push(`\n=== ${target.label}: ${pkgRoot}`);

  const pkgJsonPath = join(pkgRoot, 'package.json');
  let version = '?';
  try {
    version = JSON.parse(readFileSync(pkgJsonPath, 'utf8')).version ?? '?';
  } catch {
    /* ignore */
  }
  report.push(`dsh-pet ${version}${version === TESTED_VERSION ? '' : ` （動作確認済みは ${TESTED_VERSION}。文字列が一致しない項目は下に列挙される）`}`);

  if (hasFont) {
    const dest = join(pkgRoot, 'assets', 'fonts', fontName);
    if (!existsSync(dest)) {
      if (!dryRun) copyFileSync(fontSource, dest);
      report.push(`  font: assets/fonts/${fontName} を配置`);
      changedFiles += 1;
    } else {
      report.push(`  font: assets/fonts/${fontName} は配置済み`);
    }
  }

  patchClient(join(pkgRoot, 'lib', 'client.js'));
  patchCore(join(pkgRoot, 'lib', 'index.js'), hostJa, 'lib/index.js (host)');
  patchCore(join(pkgRoot, 'runtime', 'electron-helper', 'shared-core.js'), litJa);
  patchCore(join(pkgRoot, 'runtime', 'electron-helper', 'renderer.js'), [
    ["'配置加载失败：'", "'設定の読み込みに失敗：'"],
    // 表示先をブラウザのみにしたとき、デスクトップに赤いエラー帯を出さない（黙って待つ）
    [
      "    if (pets.length === 0) {\n      showError('配置中没有 display 为 desktop/both 的宠物，桌面模式不显示宠物');\n      scheduleReboot();\n      return;\n    }",
      "    if (pets.length === 0) {\n      // dsh-pet-ja: デスクトップ表示のペットがいないときは赤い帯を出さず静かに待つ\n      window.__dshPetDebug.configOk = true;\n      if (typeof hideError === 'function') hideError();\n      scheduleReboot();\n      return;\n    }",
    ],
  ]);

  /** ブラウザ半側：ja 辞書の登録・メニュー日本語化・UI 文言（辞書ブロックの外側だけ） */
  function patchClient(abs) {
    if (!existsSync(abs)) {
      missing.push(`client: ${abs} が無い`);
      return;
    }
    let text = readFileSync(abs, 'utf8');
    const before = text;
    const log = [];

    const zhStart = text.indexOf('const zh = {');
    const enStart = text.indexOf('const en = {');
    if (zhStart < 0 || enStart < 0) {
      missing.push('client: zh/en 辞書が見つからない（プラグインの構造が変わった可能性）');
      return;
    }
    const afterEn = text.indexOf('\n};', enStart) + '\n};'.length;
    let head = text.slice(0, zhStart);
    const dict = text.slice(zhStart, afterEn);
    let tail = text.slice(afterEn);
    const headOrig = head;
    const tailOrig = tail;

    // アニメ名の表示ラベル表をメニュー構築コードの直前に挿入
    const MENU_MARK = '/** 事件名 → 分类标签（无映射时用事件名本身） */';
    if (!head.includes('PET_JA_ANIM')) {
      const at = head.indexOf(MENU_MARK);
      if (at < 0) {
        missing.push('client: メニュー構築コードの目印が見つからない');
      } else {
        head =
          head.slice(0, at) +
          '/** 表示ラベル日本語表（dsh-pet-ja が挿入。素材名は中国語のまま、表示だけ差し替える） */\n' +
          `const PET_JA_ANIM = ${jsObject(animJa)};\n` +
          `const PET_JA_CATEGORY = ${jsObject(CATEGORY_JA)};\n\n` +
          head.slice(at);
        log.push('menu: PET_JA_ANIM / PET_JA_CATEGORY を挿入');
      }
    }

    head = applyLiterals(
      head,
      [
        ['const leaf = (anim) => ({\n\tlabel: anim,\n\tanim\n});', 'const leaf = (anim) => ({\n\tlabel: PET_JA_ANIM[anim] ?? anim,\n\tanim\n});'],
        ['\t\tlabel: c.id,', '\t\tlabel: PET_JA_CATEGORY[c.id] ?? c.id,'],
      ],
      'menu',
      log,
      missing,
      applied,
      'client.js',
    );
    head = applyLiterals(head, litJa, 'ui', log, missing, applied, 'client.js');
    tail = applyLiterals(tail, litJa, 'ui', log, missing, applied, 'client.js');

    // ja 辞書 + 言語パック
    if (!tail.includes('dsh-pet-ja: language')) {
      const REGISTER = '\t\t\t}), "dsh-pet: dictionaries");';
      if (!tail.includes(REGISTER)) {
        missing.push('client: locale.register 呼び出しが見つからない');
      } else {
        tail = tail.replace(
          REGISTER,
          REGISTER +
            `
			// dsh-pet-ja: 日本語の言語パックと辞書を追加で登録する
			ctx.effect(() => {
				try {
					return ctx.locale.addLanguage({ id: "ja", label: "日本語", fallback: "en" });
				} catch (e) {
					console.warn("[dsh-pet-ja] 言語パックの登録に失敗", e);
				}
				return void 0;
			}, "dsh-pet-ja: language");
			ctx.effect(() => {
				try {
					return ctx.locale.register(NS, "ja", ja);
				} catch (e) {
					console.warn("[dsh-pet-ja] ja 辞書の登録に失敗", e);
				}
				return void 0;
			}, "dsh-pet-ja: dictionary");`,
        );
        tail = `\n/** 日本語辞書（dsh-pet-ja が追加） */\nconst ja = ${jsObject(dictJa)};\n` + tail;
        log.push('locale: ja 辞書 + addLanguage を追加');
      }
    }

    text = head + dict + tail;
    if (hasFont) {
      const r = patchFontUrls(text, fontName);
      if (r.count > 0 && r.text !== text) {
        text = r.text;
        log.push(`font: @font-face を ${fontName} に向けた`);
      }
    }

    // head と tail で同じ表を使うため、片側にしか無い項目が「未一致」として二重に積まれる。
    // ファイル全体で見て初めて「元から無い」と言えるので、ここで積み直す。
    for (let i = missing.length - 1; i >= 0; i--) {
      if (missing[i].startsWith('client.js ui:')) missing.splice(i, 1);
    }
    for (const [from, to] of litJa) {
      if (headOrig.includes(from) || tailOrig.includes(from)) continue; // 元があった＝適用された
      if (to && text.includes(to)) continue; // 既に日本語になっている
      missing.push(`client.js ui: ${from.slice(0, 60).replace(/\n/g, '\\n')}`);
    }

    if (text !== before) {
      if (!dryRun) writeFileSync(abs, text, 'utf8');
      touched.push(abs);
      changedFiles += 1;
    }
    report.push(...log.map((l) => `  client.js: ${l}`));
  }

  /** 共有コア / ホスト半側：文言置換（+ メニュー表の挿入とラベル参照の差し替え） */
  function patchCore(abs, literals, label = abs.slice(pkgRoot.length + 1)) {
    if (!existsSync(abs)) {
      missing.push(`${label}: ファイルが無い`);
      return;
    }
    let text = readFileSync(abs, 'utf8');
    const before = text;
    const log = [];
    const MENU_MARK = '/** 事件名 → 分类标签（无映射时用事件名本身） */';
    if (!text.includes('PET_JA_ANIM') && text.includes(MENU_MARK)) {
      const at = text.indexOf(MENU_MARK);
      text =
        text.slice(0, at) +
        '/** 表示ラベル日本語表（dsh-pet-ja が挿入） */\n' +
        `const PET_JA_ANIM = ${jsObject(animJa)};\n` +
        `const PET_JA_CATEGORY = ${jsObject(CATEGORY_JA)};\n\n` +
        text.slice(at);
      log.push('menu: PET_JA_ANIM / PET_JA_CATEGORY を挿入');
    }
    text = applyLiterals(
      text,
      [
        ['const leaf = (anim) => ({\n\tlabel: anim,\n\tanim\n});', 'const leaf = (anim) => ({\n\tlabel: PET_JA_ANIM[anim] ?? anim,\n\tanim\n});'],
        ['\t\tlabel: c.id,', '\t\tlabel: PET_JA_CATEGORY[c.id] ?? c.id,'],
      ],
      'menu',
      log,
      missing,
      applied,
      label,
    );
    text = applyLiterals(text, literals, 'ui', log, missing, applied, label);
    for (const block of HOST_BLOCKS) {
      if (!block.re.test(text)) continue;
      const next = text.replace(block.re, block.out);
      if (next !== text) {
        text = next;
        log.push(`table: ${block.what} を日本語化`);
      }
    }
    if (hasFont && abs.includes('renderer.js')) {
      const r = patchFontUrls(text, fontName);
      if (r.count > 0 && r.text !== text) {
        text = r.text;
        log.push(`font: @font-face を ${fontName} に向けた`);
      }
    }
    if (text !== before) {
      if (!dryRun) writeFileSync(abs, text, 'utf8');
      touched.push(abs);
      changedFiles += 1;
    }
    report.push(...log.map((l) => `  ${label}: ${l}`));
  }
}

/* ------------------------------------------------------------------ */
/* サンプル設定                                                        */
/* ------------------------------------------------------------------ */
if (wantConfig) {
  if (existsSync(userConfigPath)) {
    report.push(`\nconfig: ${userConfigPath} は既にあるので触らない`);
  } else if (!existsSync(sampleConfig)) {
    missing.push(`config: サンプルが見つからない（${sampleConfig}）`);
  } else {
    if (!dryRun) {
      mkdirSync(dirname(userConfigPath), { recursive: true });
      copyFileSync(sampleConfig, userConfigPath);
    }
    report.push(`\nconfig: 日本語サンプルを ${userConfigPath} へコピー（内容は好みで編集する）`);
    changedFiles += 1;
  }
}

/* ------------------------------------------------------------------ */
/* 構文チェック                                                        */
/* ------------------------------------------------------------------ */
if (!dryRun) {
  for (const abs of touched) {
    const tmp = join(process.env.TEMP ?? '/tmp', `dsh-pet-ja-check-${basename(abs)}.mjs`);
    copyFileSync(abs, tmp);
    try {
      execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
      report.push(`check: OK ${abs}`);
    } catch (e) {
      report.push(`check: NG ${abs}\n${e.stderr?.toString() ?? e.message}`);
      process.exitCode = 1;
    }
  }
}

console.log(report.join('\n'));
if (applied.length > 0) {
  console.log(`\n--- 適用済みだった項目 ${applied.length} 件（再実行時はここに集まる。異常ではない）---`);
}
if (missing.length > 0) {
  // ファイルごとに件数だけ出す（大半は「そのファイルに元から無い」だけの項目）。
  // 中身を見たいときは --verbose。
  const groups = new Map();
  for (const m of missing) {
    const key = m.split(':')[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  console.log(
    `\n--- 一致しなかった項目 ${missing.length} 件（そのファイルに元から無い項目を含む。` +
      `プラグイン更新で文言が変わった場合は、ここに想定外の項目が増える。全件は --verbose）---`,
  );
  for (const [key, items] of groups) {
    console.log(`  ${key}: ${items.length} 件`);
    const show = flag('verbose') ? items : items.slice(0, 3);
    for (const item of show) console.log(`    - ${item.slice(item.indexOf(':') + 2)}`);
    if (show.length < items.length) console.log(`    …ほか ${items.length - show.length} 件`);
  }
}
console.log(
  dryRun
    ? `\n[dry-run] ${changedFiles} ファイルを変更する予定`
    : `\n完了: ${changedFiles} ファイルを更新` +
        `\n反映: ブラウザ半側はページ再読み込み／ホスト半側はプロファイル再構成か DSH 再起動`,
);
