int sub_7221B0()
{
  int result; // eax
  int i; // esi
  int v2; // ecx
  int v3; // edi
  int v4; // eax
  _DWORD *v5; // ecx
  int v6; // edx
  int v7; // [esp+8h] [ebp-8h]

  result = *(_DWORD *)&byte_A8B260;
  if ( *(_BYTE *)(*(_DWORD *)&byte_A8B260 + 13478) != 0 )
  {
    result = dword_B0F528;
    for ( i = 0; i < dword_B0F528; ++i )
    {
      v2 = *(_DWORD *)(HIDWORD(dbl_B0F518) + 4 * i);
      v3 = *(_DWORD *)(v2 + 256);
      v4 = *(_DWORD *)(v2 + 264);
      if ( v3 != -1 )
      {
        if ( unk_A8EDB4 - v3 >= v4 )
          goto LABEL_7;
        v4 -= unk_A8EDB4 - v3;
      }
      if ( v4 == 0 )
      {
LABEL_7:
        sub_722440();
        v5 = (_DWORD *)(*(_DWORD *)(HIDWORD(dbl_B0F518) + 4 * i) + 256);
        v6 = *(_DWORD *)(*(_DWORD *)(HIDWORD(dbl_B0F518) + 4 * i) + 156);
        *v5 = unk_A8EDB4;
        v5[1] = v7;
        v5[2] = v6;
      }
      result = dword_B0F528;
    }
  }
  return result;
}
