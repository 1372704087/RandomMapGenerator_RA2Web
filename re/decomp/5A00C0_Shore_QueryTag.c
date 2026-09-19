// 0x5a00c0 Shore_QueryTag size=31

int __stdcall sub_5A00C0(__int16 *a1)
{
  if ( dword_ABED10 != nullptr )
    return *((_DWORD *)dword_ABED10 + 20 * *a1 + 20 * dword_89C2DC * a1[1] + 14);
  else
    return -1;
}
