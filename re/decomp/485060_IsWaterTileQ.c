// 0x485060 IsWaterTileQ size=1D

BOOL __thiscall sub_485060(int *this)
{
  int v1; // eax

  v1 = *(this + 14);
  return v1 >= dword_AA0738 && v1 < dword_AA0738 + 14;
}
