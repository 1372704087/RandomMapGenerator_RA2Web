// 0x5a0090 Shore_SetTag size=2F

int __stdcall sub_5A0090(__int16 *a1, int a2)
{
  int result; // eax

  if ( dword_ABED10 != nullptr )
  {
    result = 80 * (*a1 + dword_89C2DC * a1[1]);
    *(_DWORD *)((char *)dword_ABED10 + result + 56) = a2;
  }
  return result;
}
