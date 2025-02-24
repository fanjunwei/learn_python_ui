#!/bin/bash
set -e
set -x
mkdir -p build
# 检测是否安装了electron-icon-maker，如果没有安装，则安装
if ! command -v electron-icon-maker &> /dev/null; then
    sudo npm install electron-icon-maker -g
fi

# 检测librsvg是否安装，如果没有安装，则安装
if ! command -v rsvg-convert &> /dev/null; then
    brew install librsvg
fi
# 使用librsvg生成icon
rsvg-convert -w 1024 -h 1024  ./res/icon.svg > ./build/icon.png
# 使用electron-icon-maker生成icon
electron-icon-maker --input=./build/icon.png --output=./build
mv build/icons/mac/icon.icns build/
mv build/icons/win/icon.ico build/