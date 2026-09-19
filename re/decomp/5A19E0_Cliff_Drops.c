// 0x5a19e0 Cliff_Drops size=285

int sub_5A19E0()
{
  int result; // eax
  int i; // esi
  int v2; // ebx
  int v3; // ebp
  int v4; // edi
  int v5; // eax
  unsigned int v6; // eax
  _DWORD *v7; // ecx
  int v8; // edx
  int v9; // esi
  int v10; // eax
  unsigned int v11; // eax
  int v12; // eax
  int v13; // [esp+4h] [ebp-18h]
  int v14; // [esp+8h] [ebp-14h]
  __int64 v15; // [esp+Ch] [ebp-10h]
  __int64 v16; // [esp+14h] [ebp-8h]

  sub_578350(&stru_87F7E8);
  result = sub_578290(&stru_87F7E8);
  for ( i = result; result != 0; i = result )
  {
    v13 = sub_481810(5);
    v14 = sub_481810(1);
    v2 = sub_481810(3);
    v3 = sub_481810(2);
    v4 = sub_481810(6);
    v5 = sub_579B70(i);
    if ( v5 == 131 )
    {
      if ( sub_579B70(v2) != 131 || !sub_486380((_DWORD *)v3) )
        goto LABEL_32;
      do
      {
        v15 = (unsigned int)sub_65C780(&unk_ABE890);
        v6 = sub_7C5F00((double)v15 * 4.656612874161595e-10);
      }
      while ( v6 > 1 );
      if ( v6 != 0 )
        goto LABEL_32;
      *(_BYTE *)(v3 + 283) -= 4;
      v7 = dword_ABED10;
      v8 = dword_ABED10 != nullptr
         ? *((_DWORD *)dword_ABED10 + 20 * *(__int16 *)(i + 36) + 20 * dword_89C2DC * *(__int16 *)(i + 38) + 14)
         : -1;
      if ( dword_ABED10 == nullptr )
        goto LABEL_32;
      v9 = *(__int16 *)(v3 + 36);
      v10 = dword_89C2DC * *(__int16 *)(v3 + 38);
    }
    else if ( v5 == 56 )
    {
      if ( sub_579B70(v2) != 56 || !sub_486380((_DWORD *)v4) )
        goto LABEL_32;
      do
      {
        v16 = (unsigned int)sub_65C780(&unk_ABE890);
        v11 = sub_7C5F00((double)v16 * 4.656612874161595e-10);
      }
      while ( v11 > 1 );
      if ( v11 != 0 )
        goto LABEL_32;
      *(_BYTE *)(v4 + 283) -= 4;
      v7 = dword_ABED10;
      v8 = dword_ABED10 != nullptr
         ? *((_DWORD *)dword_ABED10 + 20 * *(__int16 *)(i + 36) + 20 * dword_89C2DC * *(__int16 *)(i + 38) + 14)
         : -1;
      if ( dword_ABED10 == nullptr )
        goto LABEL_32;
      v9 = *(__int16 *)(v4 + 36);
      v10 = dword_89C2DC * *(__int16 *)(v4 + 38);
    }
    else
    {
      if ( v5 != 224 || sub_579B70(v13) != 224 || sub_579B70(v14) != 224 || !sub_486380((_DWORD *)i) )
        goto LABEL_32;
      *(_BYTE *)(i + 283) += 4;
      v7 = dword_ABED10;
      v8 = dword_ABED10 != nullptr
         ? *((_DWORD *)dword_ABED10 + 20 * *(__int16 *)(v4 + 36) + 20 * dword_89C2DC * *(__int16 *)(v4 + 38) + 14)
         : -1;
      if ( dword_ABED10 == nullptr )
        goto LABEL_32;
      v12 = *(__int16 *)(i + 38);
      v9 = *(__int16 *)(i + 36);
      v10 = dword_89C2DC * v12;
    }
    v7[20 * v9 + 14 + 20 * v10] = v8;
LABEL_32:
    result = sub_578290(&stru_87F7E8);
  }
  return result;
}
