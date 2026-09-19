// 0x56d3f0 Coord_LinearIndex size=36

int __thiscall sub_56D3F0(int *this, __int16 *a2)
{
  int result; // eax
  int v3; // ecx

  result = *a2 + a2[1] * (*(this + 62) + *(this + 61) + 1);
  if ( result < 0 )
    return 0;
  v3 = *(this + 27);
  if ( result >= v3 )
    return v3 - 1;
  return result;
}
