// 0x5471b0 Tile_SlopeOfSubtile size=31

int __thiscall sub_5471B0(void *this, int a2)
{
  _DWORD *v2; // eax
  int v3; // ecx

  v2 = (_DWORD *)(*(int (__thiscall **)(void *))(*(_DWORD *)this + 156))(this);
  if ( v2 != nullptr && (v3 = v2[a2 % (*v2 * v2[1]) + 4]) != 0 )
    return *(char *)(v3 + 42);
  else
    return 0;
}
