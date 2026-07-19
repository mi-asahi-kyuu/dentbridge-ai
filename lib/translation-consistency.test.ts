import { describe, expect, it } from "vitest";
import { checkTranslationConsistency } from "./translation-consistency";

describe("critical dental translation consistency", () => {
  it.each([
    ["我从昨天就开始牙疼。", "zh", "昨日からお腹が痛いです。", "ja", "身体部位"],
    ["左下の奥歯が痛いです。", "ja", "The upper right tooth hurts.", "en", "左右方向"],
    ["I am not allergic to any medication.", "en", "薬のアレルギーがあります。", "ja", "否定表現"],
    ["一天服用三次。", "zh", "一日一回服用します。", "ja", "数字・回数"],
    ["第六颗牙疼。", "zh", "第九の歯が痛いです。", "ja", "数字・回数"],
  ] as const)("blocks unsafe change: %s", (source, sourceLanguage, target, targetLanguage, reason) => {
    const result = checkTranslationConsistency(source, sourceLanguage, target, targetLanguage);
    expect(result.mismatch).toBe(true);
    expect(result.reasons.some((item) => item.includes(reason))).toBe(true);
  });

  it.each([
    ["我从昨天就开始牙疼。", "zh", "昨日から歯が痛いです。", "ja"],
    ["昨日から歯が痛いです。", "ja", "My tooth has hurt since yesterday.", "en"],
    ["左下の奥歯が痛いです。", "ja", "The lower-left back tooth hurts.", "en"],
    ["私はペニシリンにアレルギーがあります。", "ja", "I am allergic to penicillin.", "en"],
    ["血液をサラサラにする薬を飲んでいます。", "ja", "I take a blood thinner.", "en"],
    ["一天服用三次。", "zh", "一日三回服用します。", "ja"],
    ["I am not allergic to any medication.", "en", "薬のアレルギーはありません。", "ja"],
    ["The pain is on the upper right side.", "en", "痛みは右上です。", "ja"],
    ["两三天前没有肿，就是酸酸的。", "zh", "2～3日前は腫れはなく、ただ鈍くうずくような感じでした。", "ja"],
    ["两三天前没有肿，就是酸酸的。", "zh", "2、3日前は腫れておらず、ただ鈍くうずくような感じでした。", "ja"],
    ["どっちの歯ですか。一回見せてください。ここに座ってください。", "ja", "是哪颗牙？请让我看一下。请坐在这里。", "zh"],
    ["いいえ、英語を話せません。", "ja", "No, I cannot speak English.", "en"],
    ["I can't take penicillin.", "en", "ペニシリンを服用できません。", "ja"],
    ["ごめんなさい、もう一度ゆっくりお願いします。", "ja", "对不起，请再慢慢说一遍。", "zh"],
    [
      "はい、ゆっくりで大丈夫ですよ。では、今どの歯が一番気になっていますか？",
      "ja",
      "好的，慢慢来没关系。那么，现在您最在意的是哪颗牙？",
      "zh",
    ],
  ] as const)("accepts protected facts in: %s", (source, sourceLanguage, target, targetLanguage) => {
    expect(checkTranslationConsistency(source, sourceLanguage, target, targetLanguage)).toEqual({
      mismatch: false,
      reasons: [],
    });
  });

  it("still blocks a changed range or lost swelling negation", () => {
    expect(checkTranslationConsistency(
      "两三天前没有肿，就是酸酸的。",
      "zh",
      "3日前は腫れはなく、鈍くうずくような感じでした。",
      "ja",
    ).reasons).toContain("数字・回数・歯の番号が原文と一致しません");
    expect(checkTranslationConsistency(
      "两三天前没有肿，就是酸酸的。",
      "zh",
      "2～3日前は腫れていて、鈍くうずくような感じでした。",
      "ja",
    ).reasons).toContain("否定表現が原文と一致しません");
  });

  it("does not weaken real counts when accepting a polite one-time look request", () => {
    expect(checkTranslationConsistency(
      "一回見せてください。",
      "ja",
      "请让我看两次。",
      "zh",
    ).reasons).toContain("数字・回数・歯の番号が原文と一致しません");
    expect(checkTranslationConsistency(
      "一日一回服用してください。",
      "ja",
      "一天服用三次。",
      "zh",
    ).reasons).toContain("数字・回数・歯の番号が原文と一致しません");
  });

  it("keeps the required anesthesia expression in the dental test set", () => {
    const source = "麻酔がまだ効いていません。";
    expect(source).toContain("麻酔");
    expect(checkTranslationConsistency(source, "ja", "The anesthesia has not taken effect yet.", "en").mismatch).toBe(false);
  });

  it("does not claim to validate unrelated ordinary speech", () => {
    expect(checkTranslationConsistency("请慢一点。", "zh", "ゆっくりお願いします。", "ja")).toEqual({
      mismatch: false,
      reasons: [],
    });
  });

  it("still blocks an English or Japanese negation that disappears", () => {
    expect(checkTranslationConsistency(
      "いいえ、英語を話せません。",
      "ja",
      "Yes, I can speak English.",
      "en",
    ).reasons).toContain("否定表現が原文と一致しません");
    expect(checkTranslationConsistency(
      "I cannot take penicillin.",
      "en",
      "ペニシリンを服用できます。",
      "ja",
    ).reasons).toContain("否定表現が原文と一致しません");
  });

  it("neutralizes only shared courtesy phrases and still protects medical negation", () => {
    expect(checkTranslationConsistency(
      "ごめんなさい、薬のアレルギーはありません。",
      "ja",
      "对不起，我有药物过敏。",
      "zh",
    ).reasons).toContain("否定表現が原文と一致しません");
  });

  it("does not treat a Japanese superlative as tooth number one", () => {
    expect(checkTranslationConsistency(
      "今どの歯が一番気になっていますか？",
      "ja",
      "现在您最在意的是哪颗牙？",
      "zh",
    ).reasons).not.toContain("数字・回数・歯の番号が原文と一致しません");
    expect(checkTranslationConsistency(
      "1番の歯が痛いです。",
      "ja",
      "第二颗牙疼。",
      "zh",
    ).reasons).toContain("数字・回数・歯の番号が原文と一致しません");
  });

  it("does not mistake an English word containing not for negation", () => {
    expect(checkTranslationConsistency(
      "This is a notable improvement.",
      "en",
      "これは顕著な改善です。",
      "ja",
    ).reasons).not.toContain("否定表現が原文と一致しません");
  });
});
