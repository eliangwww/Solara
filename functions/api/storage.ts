// functions/api/storage.ts
export async function onRequestGet(context) {
    const { request, env, data } = context;
    const userId = data.userId;
    const url = new URL(request.url);
    const key = url.searchParams.get("key"); // 例如: 'playlists', 'history'

    if (!key) return new Response("Missing key", { status: 400 });

    const result = await env.DB.prepare("SELECT value FROM user_data WHERE user_id = ? AND key = ?")
        .bind(userId, key)
        .first();

    return new Response(result ? result.value : "[]", {
        headers: { "Content-Type": "application/json" }
    });
}

export async function onRequestPost(context) {
    const { request, env, data } = context;
    const userId = data.userId;
    const body = await request.json();
    const { key, value } = body; // value 是序列化后的 JSON 字符串

    if (!key || !value) return new Response("Missing data", { status: 400 });

    // 插入或更新用户的私人数据
    await env.DB.prepare(`
        INSERT INTO user_data (user_id, key, value) 
        VALUES (?, ?, ?) 
        ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
    `).bind(userId, key, typeof value === 'string' ? value : JSON.stringify(value)).run();

    return new Response(JSON.stringify({ success: true }));
}
