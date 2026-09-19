// 0x578350 CellRecalc_A size=33

int __thiscall sub_578350(_DWORD *this)
{
  int v1; // eax
  int result; // eax

  v1 = *(this + 61);
  *(this + 67) = 1;
  *(this + 68) = v1;
  *(this + 69) = v1 - 1;
  result = (v1 << 11) + *(this + 79) + 4;
  *(this + 70) = result;
  return result;
}
