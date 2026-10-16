# Prints bounding boxes of connected color regions. Modes: green (Decades tables), grey (Lima Twist tables), wall.
# Usage: .\detect-shapes.ps1 -Path (Resolve-Path decades-floor-map.png) -Mode green
param([string]$Path, [string]$Mode)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
public static class VipCC {
  public static List<int[]> Find(string path, string mode, int minArea) {
    var bmp = new Bitmap(path);
    int w = bmp.Width, h = bmp.Height;
    var mask = new bool[w * h];
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      var c = bmp.GetPixel(x, y);
      bool on;
      if (mode == "green") on = c.G > 150 && c.R < 160 && c.B < 110;
      else if (mode == "grey") on = (c.R + c.G + c.B) / 3 > 95 && Math.Abs(c.R - c.B) < 40;
      else on = Math.Abs(c.R - c.G) < 12 && Math.Abs(c.G - c.B) < 12 && c.R > 95 && c.R < 140;
      mask[y * w + x] = on;
    }
    var seen = new bool[w * h];
    var res = new List<int[]>();
    var stack = new Stack<int>();
    for (int i = 0; i < w * h; i++) {
      if (!mask[i] || seen[i]) continue;
      int minx = w, miny = h, maxx = 0, maxy = 0, area = 0;
      stack.Push(i); seen[i] = true;
      while (stack.Count > 0) {
        int p = stack.Pop(); int px = p % w, py = p / w; area++;
        if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py;
        int[] nb = { p - 1, p + 1, p - w, p + w };
        foreach (int q in nb) {
          if (q < 0 || q >= w * h) continue;
          if ((q == p - 1 && px == 0) || (q == p + 1 && px == w - 1)) continue;
          if (mask[q] && !seen[q]) { seen[q] = true; stack.Push(q); }
        }
      }
      if (area >= minArea) res.Add(new int[] { minx, miny, maxx, maxy, area });
    }
    bmp.Dispose();
    return res;
  }
}
"@
$min = 150
foreach ($r in [VipCC]::Find($Path, $Mode, $min)) { "{0},{1},{2},{3} area={4}" -f $r[0], $r[1], $r[2], $r[3], $r[4] }
