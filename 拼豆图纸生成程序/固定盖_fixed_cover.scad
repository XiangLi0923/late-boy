// 阿莉的图 · 拼豆固定盖（防摔 / 防砸 / 防挤压）—— 参数化 v2
// 用 OpenSCAD 打开：左侧改 size / 量真实板后改带 ⚠ VERIFY 的参数
// 单位：mm。所有 ⚠ VERIFY 参数必须拿卡尺量真实板复核！
// 对应设计需求：D1 同规格通吃 / D2 弹性卡爪 / D3 顶部限位柱 / D4 加强筋 / D5 密封唇

// ============ 1. 尺寸预设（D1：以板本体几何为基准，不挑品牌板）============

// ---- 切换尺寸：改这里 ----
size = "L";                             // S / M / L / XL

spacing = 5.0;   // 标准 5mm 拼豆孔距 (VERIFY:拿板量相邻孔中心距)
show_board = false;                     // true=显示半透明板占位看配合

// S/M/L/XL 预设: peg数(方板)。S/L有网络实测; M/XL为估算需卡尺复核
function get_peg(s) =
    (s=="S") ? 29 :
    (s=="M") ? 39 :
    (s=="L") ? 58 : 78;
peg_x = get_peg(size);
peg_y = peg_x;                          // 当前只做方板
edge_margin = 3.0;                      // 板外缘到首排孔边框宽 (VERIFY)

board_w = (peg_x - 1) * spacing + 2 * edge_margin;
board_d = board_w;

// ============ 2. 板 / 豆 参数（决定卡扣深度与限位柱长度）============
board_t = 4.0;     // ⚠ VERIFY 真实板厚（市面 3–5mm 区间），卡扣深度 clip_h 由它算
bead_h  = 5.0;     // ⚠ 豆高估算（标准 5mm 豆），影响限位柱下探长度
bead_top_z = board_t + bead_h;          // 豆顶高度（板底 z=0）

// ============ 3. 设计 / 公差参数 ============
wall        = 6.0;   // 边框+裙边厚度（D4 抗压强度）
clip_extra  = 1.5;   // 卡爪内槽比板厚多留余量（D2 弹性咬口，容忍板厚/圆角差异）
skirt_over  = 3.0;   // 裙边超出板底的长度（用于卡爪勾住板底）
slide_clear = 0.4;   // 裙边内壁与板外缘的滑动间隙
top_t       = 2.0;   // 上盖厚度（D4）
lid_gap     = 0.3;   // 盖内面与豆顶间隙（D3 轻触不压扁）
rib_h       = 3.0;   // 加强筋高度（D4 抗弯）
rib_space   = 40;    // 加强筋间距
post_step   = 2;     // 限位柱每隔几颗 peg 布一个（D3；1=每颗更密但 L 码渲染慢）
post_r      = 1.2;   // 限位柱半径
post_len    = lid_gap + 0.5;  // 限位柱伸出长度（轻压豆顶 0.5mm）

// ============ 派生尺寸 ============
lid_under_z  = bead_top_z + lid_gap;    // 盖内面高度
lid_top_z    = lid_under_z + top_t;     // 盖外顶面高度
skirt_bottom_z = -skirt_over;           // 裙边底（板底 z=0 以下）
outer_w = board_w + 2 * wall;
outer_d = board_d + 2 * wall;

// ============ 4. 主壳（裙边 + 上盖，底部开口让板推入）============
module cover_shell(){
  difference(){
    // 外块：裙边底 → 盖顶
    translate([0, 0, skirt_bottom_z])
      cube([outer_w, outer_d, lid_top_z - skirt_bottom_z]);
    // 掏内腔：底部开口，顶部留 top_t 厚盖
    translate([wall - slide_clear, wall - slide_clear, skirt_bottom_z - 0.1])
      cube([board_w + 2*slide_clear, board_d + 2*slide_clear,
            (lid_under_z - skirt_bottom_z) + 0.2]);
  }
}

// ============ 5. 弹性卡爪（D2：四边中段内凸，勾住板底）============
module clips(){
  hold = 2.0;          // 卡爪勾入板底深度
  tab_w = 24;          // 卡爪沿边宽度
  z0 = skirt_bottom_z;
  z1 = 0.0;            // 卡爪顶齐板底
  // +X / -X
  translate([ board_w/2 - hold, -tab_w/2, z0]) cube([hold + slide_clear + 0.01, tab_w, z1 - z0]);
  translate([-board_w/2 - slide_clear, -tab_w/2, z0]) cube([hold + slide_clear + 0.01, tab_w, z1 - z0]);
  // +Y / -Y
  translate([-tab_w/2,  board_d/2 - hold, z0]) cube([tab_w, hold + slide_clear + 0.01, z1 - z0]);
  translate([-tab_w/2, -board_d/2 - slide_clear, z0]) cube([tab_w, hold + slide_clear + 0.01, z1 - z0]);
}

// ============ 6. 顶部限位柱（D3：替代海绵，阵列压豆顶）============
module posts(){
  for(i=[0 : post_step : peg_x - 1])
    for(j=[0 : post_step : peg_y - 1]){
      x = -board_w/2 + edge_margin + i * spacing;
      y = -board_d/2 + edge_margin + j * spacing;
      translate([x, y, lid_under_z - post_len])
        cylinder(r = post_r, h = post_len, $fn = 12);
    }
}

// ============ 7. 加强筋（D4：盖顶网格，抗弯/抗压）============
module ribs(){
  rib_t = 3.0;
  for(x = [-outer_w/2 + rib_space : rib_space : outer_w/2 - rib_space])
    translate([x - rib_t/2, -outer_d/2, lid_top_z]) cube([rib_t, outer_d, rib_h]);
  for(y = [-outer_d/2 + rib_space : rib_space : outer_d/2 - rib_space])
    translate([-outer_w/2, y - rib_t/2, lid_top_z]) cube([outer_w, rib_t, rib_h]);
}

// ============ 8. 密封唇（D5：底缘内凸薄边，轻贴板侧防尘；TPE 更佳）============
module seal_lip(){
  lip_t = 0.8;
  lip_h = 2.5;
  for(sx=[-1,1])
    translate([sx*(board_w/2 + slide_clear - lip_t), -(board_d/2 + slide_clear), skirt_bottom_z])
      cube([lip_t, board_d + 2*slide_clear, lip_h]);
  for(sy=[-1,1])
    translate([-(board_w/2 + slide_clear), sy*(board_d/2 + slide_clear - lip_t), skirt_bottom_z])
      cube([board_w + 2*slide_clear, lip_t, lip_h]);
}

// ============ 9. 板占位（仅预览，不打印）============
module board_dummy(){
  %cube([board_w, board_d, board_t]);
}

// ============ 装配 ============
cover_shell();
clips();
posts();
ribs();
seal_lip();
if(show_board) board_dummy();

// 提示：
// 1) 导出硬壳 STL：全选渲染(F6)后 Export→STL（PETG/ABS）。
// 2) 密封唇若用 TPE 软胶，单独导出 seal_lip() 分材料打印后装配。
// 3) 限位柱若压得太狠（豆顶被顶变形），调大 lid_gap 或减小 post_len。
// 4) 卡爪装不上/太松：调 clip_extra（小=更紧）与 skirt_over。
// 5) 渲染慢（尤其 L/XL）：把 post_step 调大（如 3）先预览，定稿再调回 1–2。
