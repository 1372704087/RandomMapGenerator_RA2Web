// 0x4865d0 TerrainTest_WaterFamily size=72

bool __thiscall sub_4865D0(int *this)
{
  int v1; // eax

  v1 = *(this + 14);
  if ( v1 >= dword_ABAD28 && v1 < dword_ABAD28 + 42 )
    return true;
  return v1 >= dword_AA0738 && v1 < dword_AA0738 + 14
      || v1 >= dword_AA073C && v1 < dword_AA073C + 4
      || v1 >= dword_ABB110 && v1 < dword_ABB110 + 4
      || v1 >= dword_AA1050 && v1 < dword_AA1050 + 4
      || v1 >= dword_AA10A0 && v1 < dword_AA10A0 + 4;
}
