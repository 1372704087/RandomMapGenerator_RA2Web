// 0x58cf90 Region_Partition size=79

int __thiscall sub_58CF90(void *this)
{
  int result; // eax
  int v2; // ebx
  int v3; // esi
  int *v4; // edi
  void *v5; // [esp+0h] [ebp-4h] BYREF

  v5 = this;
  result = dword_89C2DC * dword_89C2DC;
  if ( dword_89C2DC * dword_89C2DC > 0 )
  {
    v2 = dword_89C2DC * dword_89C2DC;
    result = (int)dword_ABED10;
    v3 = 0;
    do
    {
      v5 = *(void **)(v3 + result);
      v4 = (int *)sub_5657A0(&v5);
      result = (int)dword_ABED10;
      if ( *(_DWORD *)((char *)dword_ABED10 + v3 + 56) == -1
        && (*(_WORD *)((char *)dword_ABED10 + v3) != 0 || *(_WORD *)((char *)dword_ABED10 + v3 + 2) != 0) )
      {
        if ( sub_4865D0(v4) || sub_4867B0(v4) )
          sub_58C800((int)v4);
        result = (int)dword_ABED10;
      }
      v3 += 80;
      --v2;
    }
    while ( v2 != 0 );
  }
  return result;
}
