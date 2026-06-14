#!/bin/sh
# 重新生成 Material Symbols 字体子集（新增图标后执行）
# 用法: sh scripts/fetch-font.sh
set -e

ICONS="account_tree,add,android,arrow_downward,arrow_upward,bookmark,check_circle,chevron_left,chevron_right,close,cloud_upload,code,content_copy,content_cut,content_paste,create_new_folder,dark_mode,data_object,delete,description,desktop_windows,disc_full,download,draft,drive_folder_upload,edit,error,expand_more,folder,folder_open,folder_zip,font_download,grid_view,home,hourglass_empty,image,inventory_2,light_mode,link,logout,menu,more_vert,movie,music_note,navigate_before,navigate_next,open_in_new,phone_iphone,picture_as_pdf,radio_button_unchecked,refresh,search,settings,share,slideshow,swap_vert,sync,table_chart,terminal,unfold_more,upload,view_list,visibility"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
CSS_URL="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=${ICONS}&display=block"

WOFF2_URL=$(curl -sL "$CSS_URL" -A "$UA" | grep -o 'https://[^)]*' | head -1)
[ -n "$WOFF2_URL" ] || { echo "获取字体地址失败"; exit 1; }
curl -sL -o src/static/material-symbols.woff2 "$WOFF2_URL"
echo "已更新 src/static/material-symbols.woff2"
