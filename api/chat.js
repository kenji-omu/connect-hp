/**
 * Vercel サーバーレス関数 — Claude API プロキシ（SSEストリーミング）
 */

import Anthropic from '@anthropic-ai/sdk';

// チャットボットのシステムプロンプト
const SYSTEM_PROMPT = `あなたは株式会社connectのAIアシスタント「Connect AI」です。
訪問者からの質問に、丁寧かつ親しみやすい日本語でお答えください。

【会社概要】
会社名: 株式会社 connect
代表取締役: 大室 賢時
設立: 2023年4月（予定）
所在地: 東京都
ミッション: 人を繋いで、人生を豊かにする
ビジョン: AIで、すべての業務を変える
事業内容: AI業務効率化ソリューションの開発・提供、AIコンサルティング・システム開発

【サービスラインナップ】
1. AIチャットボット開発 — 顧客対応・社内問い合わせの24時間自動化。LLMをカスタム開発。
2. 業務自動化（RPA）— 繰り返し作業をロボットが代行。データ入力・集計・メール送信等。
3. データ分析・AI導入コンサル — 課題発見から導入設計、運用定着まで一貫サポート。
4. 営業の自動化 — リード獲得からナーチャリング、商談設定までAIが自動対応。
5. 社内ナレッジAI — 社内文書・マニュアルを学習させたAIアシスタント構築（RAG）。
6. AIシステム連携・API開発 — 既存システムへのAI機能追加やSaaS間データ連携。

【お問い合わせ】
お問い合わせはページ内のContactセクションのフォームからどうぞ。
初回相談は無料です。通常1営業日以内にご返信します。

【回答ガイドライン】
- 回答は簡潔（目安200文字以内）かつ親切にまとめる
- 具体的な金額・社外秘情報は「詳しくはお問い合わせください」と案内する
- 絵文字を適度に使って親しみやすい雰囲気にする
- 会社やサービスに無関係な質問は、軽く案内しつつサービスの話題に誘導する`;

export default async function handler(req, res) {
  // POSTのみ許可
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  // バリデーション
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messagesの配列が必要です' });
  }

  // SSEヘッダーを設定
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Claude API にストリーミングリクエスト
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages,
    });

    // テキストデルタをSSEで送信
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    // ストリーム終了を通知
    res.write('data: [DONE]\n\n');
  } catch (error) {
    console.error('Claude API エラー:', error.message);
    res.write(
      `data: ${JSON.stringify({ error: 'エラーが発生しました。しばらくしてからお試しください。' })}\n\n`
    );
  }

  res.end();
}
