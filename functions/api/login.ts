// functions/api/login.ts
async function hashPassword(password: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken() {
    return crypto.randomUUID();
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const body = await request.json();
    const { action, username, password, registerCode } = body;

    if (!username || !password) {
        return new Response(JSON.stringify({ error: "用户名或密码不能为空" }), { status: 400 });
    }

    const db = env.DB;
    const hashedPassword = await hashPassword(password);

    if (action === 'register') {
        // 校验注册码
        if (registerCode !== env.REGISTER_CODE) {
            return new Response(JSON.stringify({ error: "注册码无效" }), { status: 403 });
        }

        // 检查用户是否已存在
        const existingUser = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
        if (existingUser) {
            return new Response(JSON.stringify({ error: "用户名已存在" }), { status: 409 });
        }

        // 插入新用户
        await db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
            .bind(username, hashedPassword)
            .run();
        
        return new Response(JSON.stringify({ success: true, message: "注册成功，请登录" }));
    } 
    
    if (action === 'login') {
        // 验证用户
        const user = await db.prepare("SELECT id FROM users WHERE username = ? AND password_hash = ?")
            .bind(username, hashedPassword)
            .first();

        if (!user) {
            return new Response(JSON.stringify({ error: "用户名或密码错误" }), { status: 401 });
        }

        // 生成 Token 并存入 sessions 表 (有效期 30 天)
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
            .bind(token, user.id, expiresAt)
            .run();

        return new Response(JSON.stringify({ success: true, token: token }), {
            headers: {
                // 将 Token 写入 Cookie
                "Set-Cookie": `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
            }
        });
    }

    return new Response(JSON.stringify({ error: "未知的操作" }), { status: 400 });
}
