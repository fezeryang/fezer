#!/bin/bash
# 验证 3D简历聊天加载动画增强实现

echo "========================================="
echo "验证 3D简历聊天加载动画增强实现"
echo "========================================="
echo ""

# 1. 检查依赖
echo "✓ 检查 lottie-react 依赖..."
if grep -q "lottie-react" package.json; then
    echo "  ✓ lottie-react 已安装"
else
    echo "  ✗ lottie-react 未找到"
    exit 1
fi

# 2. 检查新建文件
echo ""
echo "✓ 检查新建文件..."
files=(
    "client/src/components/jianli/LoadingAnimation.tsx"
    "client/src/components/jianli/ThinkingIndicator.tsx"
    ".trellis/tasks/06-14-jianli-loading-animation/prd.md"
    "docs/jianli-loading-implementation-summary.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file 不存在"
        exit 1
    fi
done

# 3. 检查 Lottie 动画资源
echo ""
echo "✓ 检查动画资源..."
if [ -f "thecat/cat Mark loading.json" ]; then
    echo "  ✓ Lottie 动画文件存在"
else
    echo "  ✗ Lottie 动画文件未找到"
fi

# 4. 检查 TypeScript 编译
echo ""
echo "✓ 运行 TypeScript 检查..."
if npm run check > /dev/null 2>&1; then
    echo "  ✓ TypeScript 检查通过"
else
    echo "  ✗ TypeScript 检查失败"
    npm run check
    exit 1
fi

# 5. 检查关键代码片段
echo ""
echo "✓ 检查代码集成..."
if grep -q "ThinkingIndicator" client/src/components/jianli/ChatModal.tsx; then
    echo "  ✓ ChatModal 已导入 ThinkingIndicator"
else
    echo "  ✗ ChatModal 未导入 ThinkingIndicator"
    exit 1
fi

if grep -q "thinkingState" client/src/hooks/useAgentChat.ts; then
    echo "  ✓ useAgentChat 添加了 thinkingState"
else
    echo "  ✗ useAgentChat 缺少 thinkingState"
    exit 1
fi

echo ""
echo "========================================="
echo "✓ 所有检查通过！"
echo "========================================="
echo ""
echo "下一步："
echo "1. 启动开发服务器: pnpm dev"
echo "2. 访问 http://localhost:5173/jianli"
echo "3. 点击 Agent 并发送消息"
echo "4. 观察新的加载动画"
echo ""
