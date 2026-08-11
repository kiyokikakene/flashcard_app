/**
 * 単語帳アプリ バックエンド (Google Apps Script, スプレッドシートに紐付けて実行する)
 *
 * セットアップ:
 * 1. Google スプレッドシートを新規作成
 * 2. 拡張機能 > Apps Script を開き、このファイルの内容を丸ごと貼り付け
 * 3. デプロイ > 新しいデプロイ > 種類「ウェブアプリ」
 *    - 実行するユーザー: 自分
 *    - アクセスできるユーザー: 全員
 * 4. 発行されたウェブアプリURLをフロントエンド(index.html)の設定画面に登録する
 */

var SHEET_QUESTIONS = 'Questions';
var SHEET_RECORDS = 'Records';
var SHEET_MARKS = 'Marks';
var SHEET_MARK_TYPES = 'MarkTypes';

var HEADERS = {
  Questions: ['id', 'type', 'front', 'back', 'category'],
  Records: ['timestamp', 'id', 'mode', 'result'],
  Marks: ['timestamp', 'id', 'markType'],
  MarkTypes: ['name']
};

var DEFAULT_MARK_TYPES = ['重要', '苦手', 'あとで見る'];

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(HEADERS[name]);
    if (name === SHEET_MARK_TYPES) {
      DEFAULT_MARK_TYPES.forEach(function (t) {
        sheet.appendRow([t]);
      });
    }
  }
  return sheet;
}

function sheetToObjects_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = values.slice(1);
  return rows
    .filter(function (row) {
      return row.some(function (cell) {
        return cell !== '' && cell !== null;
      });
    })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) {
        obj[h] = row[i];
      });
      return obj;
    });
}

function jsonOut_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet(e) {
  var action = e.parameter.action;
  try {
    if (action === 'questions') {
      return jsonOut_({ ok: true, data: getQuestions_() });
    }
    if (action === 'markTypes') {
      return jsonOut_({ ok: true, data: getMarkTypes_() });
    }
    if (action === 'stats') {
      return jsonOut_({ ok: true, data: getStats_() });
    }
    return jsonOut_({ ok: false, error: 'unknown action: ' + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    if (action === 'addRecord') {
      addRecord_(body.payload);
      return jsonOut_({ ok: true });
    }
    if (action === 'addMark') {
      addMark_(body.payload);
      return jsonOut_({ ok: true });
    }
    if (action === 'addQuestions') {
      addQuestions_(body.payload);
      return jsonOut_({ ok: true });
    }
    if (action === 'addMarkType') {
      addMarkType_(body.payload);
      return jsonOut_({ ok: true });
    }
    if (action === 'deleteQuestion') {
      deleteQuestion_(body.payload);
      return jsonOut_({ ok: true });
    }
    return jsonOut_({ ok: false, error: 'unknown action: ' + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function getQuestions_() {
  return sheetToObjects_(getSheet_(SHEET_QUESTIONS));
}

function getMarkTypes_() {
  var rows = sheetToObjects_(getSheet_(SHEET_MARK_TYPES));
  return rows.map(function (r) {
    return r.name;
  });
}

function addRecord_(payload) {
  var sheet = getSheet_(SHEET_RECORDS);
  sheet.appendRow([new Date(), payload.id, payload.mode, payload.result]);
}

function addMark_(payload) {
  var sheet = getSheet_(SHEET_MARKS);
  sheet.appendRow([new Date(), payload.id, payload.markType]);
}

function addMarkType_(payload) {
  var sheet = getSheet_(SHEET_MARK_TYPES);
  var existing = getMarkTypes_();
  if (existing.indexOf(payload.name) === -1) {
    sheet.appendRow([payload.name]);
  }
}

function addQuestions_(payload) {
  var sheet = getSheet_(SHEET_QUESTIONS);
  var questions = payload.questions || [];
  questions.forEach(function (q) {
    var id = q.id && String(q.id).trim() ? q.id : Utilities.getUuid();
    sheet.appendRow([id, q.type, q.front, q.back, q.category || '']);
  });
}

function deleteQuestion_(payload) {
  var sheet = getSheet_(SHEET_QUESTIONS);
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === String(payload.id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function getStats_() {
  var records = sheetToObjects_(getSheet_(SHEET_RECORDS));
  var marks = sheetToObjects_(getSheet_(SHEET_MARKS));
  var stats = {};

  function ensure(id) {
    if (!stats[id]) {
      stats[id] = {
        attempts: 0,
        correct: 0,
        partial: 0,
        wrong: 0,
        reviewed: 0,
        marks: {}
      };
    }
    return stats[id];
  }

  records.forEach(function (r) {
    var s = ensure(r.id);
    if (r.mode === 'quiz') {
      s.attempts += 1;
      if (r.result === 'correct') s.correct += 1;
      else if (r.result === 'partial') s.partial += 1;
      else if (r.result === 'wrong') s.wrong += 1;
    } else if (r.mode === 'word') {
      s.reviewed += 1;
    }
  });

  marks.forEach(function (m) {
    var s = ensure(m.id);
    s.marks[m.markType] = (s.marks[m.markType] || 0) + 1;
  });

  return stats;
}
