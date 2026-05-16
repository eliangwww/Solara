// functions/_middleware.ts
export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    // 如果是访问公开资源或登录注册接口，直接放行
    if (url.pathname.startsWith('/api/login') || url.pathname.includes('.')) {
        return next();
    }

    // 提取 Cookie 中的 token
    const cookieHeader = request.headers.get("Cookie") || "";
    const match = cookieHeader.match(/auth_token=([^;]+)/);
    const token = match ? match[1] : null;

    if (!token && url.pathname.startsWith('/api/storage')) {
        return new Response("Unauthorized", { status: 401 });
    }

    if (token) {
        // 验证 Token
        const session = await env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')")
            .bind(token)
            .first();
        
        if (session) {
            // 将用户 ID 注入到 data 中供 storage.ts 使用
            context.data.userId = session.user_id;
        } else if (url.pathname.startsWith('/api/storage')) {
            return new Response("Unauthorized", { status: 401 });
        }
    }

    return next();
}
