#!/bin/bash
# 验证房间链接导航功能

echo "========================================="
echo "验证房间链接导航功能"
echo "========================================="
echo ""

# 1. 检查新建文件
echo "✓ 检查新建文件..."
files=(
    "client/src/components/jianli/utils/roomLinks.tsx"
    ".trellis/tasks/06-14-room-link-navigation/prd.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file 不存在"
        exit 1
    fi
done

# 2. 检查 TypeScript 编译
echo ""
echo "✓ 运行 TypeScript 检查..."
if npm run check > /dev/null 2>&1; then
    echo "  ✓ TypeScript 检查通过"
else
    echo "  ✗ TypeScript 检查失败"
    npm run check
    exit 1
fi

# 3. 检查关键代码片段
echo ""
echo "✓ 检查代码集成..."

if grep -q "linkifyRoomNames" client/src/components/jianli/ChatModal.tsx; then
    echo "  ✓ ChatModal 已导入 linkifyRoomNames"
else
    echo "  ✗ ChatModal 未导入 linkifyRoomNames"
    exit 1
fi

if grep -q "onRoomSwitch" client/src/components/jianli/ChatModal.tsx; then
    echo "  ✓ ChatModal 添加了 onRoomSwitch prop"
else
    echo "  ✗ ChatModal 缺少 onRoomSwitch prop"
    exit 1
fi

if grep -q "onRoomSwitch={setActiveRoomId}" client/src/pages/Jianli.tsx; then
    echo "  ✓ Jianli 传递了 onRoomSwitch"
else
    echo "  ✗ Jianli 未传递 onRoomSwitch"
    exit 1
fi

# 4. 测试房间名称模式
echo ""
echo "✓ 测试房间名称识别..."
test_patterns=(
    "Builder Room"
    "AI Lab"
    "Central Hub"
    "Writer Room"
    "Reader Nook"
    "Visual Studio"
    "Wanderer Base"
    "搭建空间"
    "AI 实验室"
    "中央大厅"
)

for pattern in "${test_patterns[@]}"; do
    if grep -q "$pattern" client/src/components/jianli/utils/roomLinks.tsx; then
        echo "  ✓ 支持 \"$pattern\""
    else
        echo "  ⚠ 未找到 \"$pattern\" 模式"
    fi
done

echo ""
echo "========================================="
echo "✓ 所有检查通过！"
echo "========================================="
echo ""
echo "功能说明："
echo "1. Agent 回答中的房间名称现在可点击"
echo "2. 点击后自动切换到对应房间并关闭聊天"
echo "3. 支持英文和中文房间名称"
echo ""
echo "测试步骤："
echo "1. 启动开发服务器: pnpm dev"
echo "2. 访问 http://localhost:5173/jianli"
echo "3. 点击 Agent 并发送: '请介绍一下各个房间'"
echo "4. Agent 回答中的房间名称应该是蓝色可点击的"
echo "5. 点击任意房间名称，验证："
echo "   - 相机切换到对应房间"
echo "   - 聊天窗口关闭"
echo ""
