// 0x57a320 Shore_Pass2 size=108

int __stdcall sub_57A320(int a1, int a2, int a3)
{
  _DWORD *v3; // ebp
  int result; // eax
  signed int v5; // ebx
  bool v6; // zf
  _DWORD *v7; // esi
  int v8; // edx
  int v9; // edi
  int v10; // edi

  v3 = (_DWORD *)a1;
  result = *(_DWORD *)(a1 + 56);
  if ( result >= dword_AA0738 && result < dword_AA0738 + 12 )
  {
    result = sub_57B210(a1, 2);
    if ( result == 199
      || result == 124
      || result == 241
      || result == 31
      || result == 198
      || result == 108
      || result == 177
      || result == 27 )
    {
      v5 = 0;
      v6 = (_BYTE)a3 == 0;
      *(_DWORD *)(a1 + 56) = 0xFFFF;
      *(_BYTE *)(a1 + 282) = 0;
      if ( !v6 )
        *(_DWORD *)(sub_58C2A0(a1 + 36) + 56) = a2;
      do
      {
        v7 = sub_481810(v3, v5);
        v8 = v7[9];
        a3 = v8;
        result = SHIWORD(v8);
        v9 = SHIWORD(v8) + (__int16)v8;
        if ( v9 > dword_ABED04 )
        {
          if ( (__int16)a3 - SHIWORD(a3) < dword_ABED04 )
          {
            result = SHIWORD(a3) - (__int16)a3;
            if ( result < dword_ABED04 && v9 <= dword_ABED08 )
            {
              a3 = v8;
              v10 = sub_58C2A0(&a3);
              *(_DWORD *)(v10 + 64) = -1;
              result = sub_57B210(v7, 2);
              *(_DWORD *)(v10 + 64) = result;
            }
          }
          v3 = (_DWORD *)a1;
        }
        ++v5;
      }
      while ( v5 < 8 );
    }
  }
  return result;
}
