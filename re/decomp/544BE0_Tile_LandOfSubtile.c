// 0x544be0 Tile_LandOfSubtile size=38

int __thiscall sub_544BE0(void *this, int a2)
{
  _DWORD *v2; // eax
  int v3; // ecx

  v2 = (_DWORD *)(*(int (__thiscall **)(void *))(*(_DWORD *)this + 156))(this);
  if ( v2 != nullptr && (v3 = v2[a2 % (*v2 * v2[1]) + 4]) != 0 )
    return dword_8288E4[*(char *)(v3 + 41)];
  else
    return 0;
}
