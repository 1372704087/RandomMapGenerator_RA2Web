// 0x544c20 Tile_FrameValidQ size=53

bool __thiscall sub_544C20(_DWORD *this, int a2, char a3)
{
  _DWORD *v4; // eax

  if ( a3 != 0 && *(this + 41) == 0 && *((_BYTE *)this + 756) != 0 )
    sub_547020();
  v4 = (_DWORD *)(*(int (__thiscall **)(_DWORD *))(*this + 156))(this);
  return v4 != nullptr && a2 < *v4 * v4[1] && v4[a2 + 4] != 0;
}
