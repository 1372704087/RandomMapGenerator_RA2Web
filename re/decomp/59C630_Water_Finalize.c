// 0x59c630 Water_Finalize size=1C9

int sub_59C630()
{
  int result; // eax
  int i; // esi
  int v2; // edi
  int v3; // ebp
  int v4; // eax
  unsigned int v5; // eax
  int v6; // eax
  unsigned int v7; // ecx
  __int64 v8; // [esp+8h] [ebp-18h]
  __int64 v9; // [esp+10h] [ebp-10h]
  __int64 v10; // [esp+18h] [ebp-8h]

  sub_578350(&stru_87F7E8);
  result = sub_578290(&stru_87F7E8);
  for ( i = result; result != 0; i = result )
  {
    if ( *(_DWORD *)(i + 56) == dword_AA0738 && *(_BYTE *)(i + 282) == 0 )
    {
      v2 = sub_481810(2);
      v3 = sub_481810(4);
      v4 = sub_481810(3);
      if ( *(_DWORD *)(v2 + 56) != dword_AA0738
        || *(_BYTE *)(v2 + 282) != 0
        || *(_DWORD *)(v3 + 56) != dword_AA0738
        || *(_BYTE *)(v3 + 282) != 0
        || *(_DWORD *)(v4 + 56) != dword_AA0738
        || *(_BYTE *)(v4 + 282) != 0 )
      {
        goto LABEL_22;
      }
      do
      {
        v8 = (unsigned int)sub_65C780(&unk_ABE890);
        v5 = sub_7C5F00((double)v8 * 0.000000002328306437080797 + 1.0);
      }
      while ( v5 > 0xA );
      if ( v5 == 1 )
      {
LABEL_22:
        do
        {
          v10 = (unsigned int)sub_65C780(&unk_ABE890);
          v7 = sub_7C5F00((double)v10 * 0.00000004679895938532403);
        }
        while ( v7 > 0xC8 );
        *(_DWORD *)(i + 56) = v7 / 0x28 + dword_AA0738 + 8;
      }
      else
      {
        do
          v9 = (unsigned int)sub_65C780(&unk_ABE890);
        while ( (unsigned int)sub_7C5F00((double)v9 * 0.0000000563450157773553) > 0xF1 );
        if ( dword_ABED10 != nullptr )
          v6 = *((_DWORD *)dword_ABED10 + 20 * *(__int16 *)(i + 36) + 20 * dword_89C2DC * *(__int16 *)(i + 38) + 14);
        else
          v6 = -1;
        sub_5A6C10(v6, -1);
      }
    }
    result = sub_578290(&stru_87F7E8);
  }
  return result;
}
