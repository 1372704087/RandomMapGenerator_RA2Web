// 0x4865b0 IsShorePieceTile size=1A

bool __thiscall sub_4865B0(int *this)
{
  int v1; // eax

  v1 = *(this + 14);
  return v1 >= dword_ABAD28 && v1 < dword_ABAD28 + 42;
}
