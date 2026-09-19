// 0x5ac230 Coord_InDiamondQ size=35

bool __thiscall sub_5AC230(__int16 *this)
{
  int v1; // edx
  int v2; // eax

  v1 = *this;
  v2 = *(this + 1);
  return v2 + v1 > dword_ABED04 && v1 - v2 < dword_ABED04 && v2 - v1 < dword_ABED04 && v2 + v1 <= dword_ABED08;
}
