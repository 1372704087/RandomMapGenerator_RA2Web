// 0x58d010 Region_Hierarchy size=52

int __fastcall sub_58D010(char a1)
{
  int result; // eax
  int v3; // esi
  int v4; // edi
  int v5; // eax

  result = dword_89C2DC * dword_89C2DC;
  if ( dword_89C2DC * dword_89C2DC > 0 )
  {
    v3 = 0;
    v4 = dword_89C2DC * dword_89C2DC;
    do
    {
      result = (int)dword_ABED10 + v3;
      if ( *(_DWORD *)((char *)dword_ABED10 + v3 + 56) == -1 && (*(_WORD *)result != 0 || *(_WORD *)(result + 2) != 0) )
      {
        v5 = sub_5657A0((char *)dword_ABED10 + v3);
        result = sub_58C800(v5);
        if ( result != 0 )
          *(_BYTE *)(result + 26) = a1;
      }
      v3 += 80;
      --v4;
    }
    while ( v4 != 0 );
  }
  return result;
}
