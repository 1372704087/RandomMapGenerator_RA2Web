// 0x5a5b50 watch_5A5B50 size=9B2

__int16 __thiscall sub_5A5B50(void *this, int a2)
{
  int *v2; // eax
  int v3; // ecx
  int v4; // edx
  int v5; // eax
  int v6; // ebx
  int v7; // eax
  unsigned int v8; // eax
  __int16 v9; // ax
  __int16 v10; // cx
  int i; // esi
  unsigned int v12; // eax
  int v13; // ebx
  char v14; // bl
  unsigned int v15; // eax
  int v16; // ebx
  int v17; // esi
  __int64 v19; // [esp+10h] [ebp-118h] BYREF
  char v20; // [esp+1Ah] [ebp-10Eh]
  char v21; // [esp+1Bh] [ebp-10Dh]
  int v22; // [esp+1Ch] [ebp-10Ch] BYREF
  __int16 v23; // [esp+20h] [ebp-108h] BYREF
  __int16 v24; // [esp+22h] [ebp-106h]
  char v25; // [esp+27h] [ebp-101h]
  int v26; // [esp+28h] [ebp-100h] BYREF
  int v27; // [esp+2Ch] [ebp-FCh]
  int v28; // [esp+30h] [ebp-F8h]
  int v29; // [esp+34h] [ebp-F4h]
  int v30; // [esp+38h] [ebp-F0h]
  int v31; // [esp+3Ch] [ebp-ECh]
  _DWORD v32[2]; // [esp+40h] [ebp-E8h] BYREF
  int v33; // [esp+48h] [ebp-E0h]
  int v34; // [esp+4Ch] [ebp-DCh]
  int v35; // [esp+50h] [ebp-D8h]
  int v36; // [esp+54h] [ebp-D4h]
  int v37; // [esp+58h] [ebp-D0h] BYREF
  int v38; // [esp+5Ch] [ebp-CCh]
  int v39; // [esp+60h] [ebp-C8h]
  int v40; // [esp+64h] [ebp-C4h]
  int v41; // [esp+68h] [ebp-C0h]
  __int64 v42; // [esp+6Ch] [ebp-BCh]
  int v43; // [esp+74h] [ebp-B4h]
  int v44; // [esp+78h] [ebp-B0h]
  __int64 v45; // [esp+7Ch] [ebp-ACh]
  int v46; // [esp+84h] [ebp-A4h]
  int v47; // [esp+88h] [ebp-A0h]
  __int64 v48; // [esp+8Ch] [ebp-9Ch] BYREF
  _DWORD v49[8]; // [esp+94h] [ebp-94h] BYREF
  _DWORD v50[20]; // [esp+B4h] [ebp-74h] BYREF
  _DWORD v51[8]; // [esp+104h] [ebp-24h] BYREF
  char v52[4]; // [esp+124h] [ebp-4h] BYREF

  v32[1] = this;
  v2 = (int *)sub_5A7640(v49, a2);
  v3 = *v2;
  v37 = *v2;
  v4 = v2[1];
  v38 = v4;
  v39 = v2[2];
  v5 = v2[3];
  v40 = v5;
  if ( v5 > 5 )
  {
    v6 = v5 - 2;
    v24 = v4 + 2;
    v23 = v3;
    do
    {
      v26 = *(_DWORD *)sub_5A6D80(&v22, &v23, &v37, 2);
      v7 = *(_DWORD *)sub_5A7070(v32, &v26, &v37, 2);
      v27 = v7;
      if ( v7 != 0 && (v23 != 0 || v24 != 0) && (__int16)v7 - v23 >= 6 )
      {
        HIDWORD(v45) = SHIWORD(v26);
        LODWORD(v45) = (__int16)v26 - 4;
        v46 = 4;
        v47 = 3;
        if ( (unsigned __int8)sub_5A7250(0) == 0 )
          goto LABEL_11;
        do
        {
          v19 = (unsigned int)sub_65C780(&unk_ABE890);
          v8 = sub_7C5F00((double)v19 * 4.656612874161595e-10);
        }
        while ( v8 > 1 );
        if ( v8 != 0 )
        {
          HIWORD(v30) = HIWORD(v26);
          LOWORD(v30) = v26 - 3;
          v28 = v30;
          sub_5A6C10(-1, -1);
        }
        else
        {
LABEL_11:
          sub_5A6C10(-1, -1);
        }
        v9 = v26;
        v10 = v27;
        for ( i = 0; i < (__int16)v27 - (__int16)v26 - 1; ++i )
        {
          LOWORD(v31) = i + 1;
          LOWORD(v29) = v9 + i + 1;
          HIWORD(v29) = HIWORD(v26);
          v28 = v29;
          sub_5A6C10(-1, -1);
          v9 = v26;
          v10 = v27;
        }
        HIDWORD(v42) = SHIWORD(v27);
        LODWORD(v42) = v10;
        v43 = 4;
        v44 = 3;
        if ( (unsigned __int8)sub_5A7250(0) != 0 )
        {
          do
          {
            v48 = (unsigned int)sub_65C780(&unk_ABE890);
            v12 = sub_7C5F00((double)v48 * 4.656612874161595e-10);
          }
          while ( v12 > 1 );
        }
        sub_5A6C10(-1, -1);
        v6 -= 10;
        v24 += 10;
      }
      else
      {
        v24 += 2;
        v6 -= 2;
      }
    }
    while ( v6 > 3 );
    LOWORD(v3) = v37;
    LOWORD(v4) = v38;
    v5 = v40;
  }
  if ( v39 > 8 )
  {
    v13 = v5 - 5;
    v26 = v5 - 5;
    v23 = v3 + 5;
    v24 = v4;
    while ( v13 > 3 )
    {
      LODWORD(v19) = *(_DWORD *)sub_5A6D80(v52, &v23, &v37, 4);
      v5 = *(_DWORD *)sub_5A7070(&v48, &v19, &v37, 4);
      v27 = v5;
      if ( v5 != 0 && ((LOWORD(v5) = v24, v23 != 0) || v24 != 0) && (LOWORD(v5) = v24, SHIWORD(v5) - v24 >= 6) )
      {
        LOWORD(v5) = WORD1(v19);
        v21 = 0;
        v14 = 1;
        v20 = 0;
        v25 = 0;
        if ( SWORD1(v19) < SHIWORD(v5) )
        {
          while ( 1 )
          {
            if ( v21 != 0 )
            {
              v50[8] = (__int16)v19;
              v50[9] = (__int16)v5;
              v50[10] = 3;
              v50[11] = 1;
              if ( (unsigned __int8)sub_5A7250(0) != 0 )
              {
                sub_5A6C10(-1, -1);
                if ( v20 != 0 )
                {
                  if ( v25 != 0 )
                  {
                    HIWORD(v36) = WORD1(v19);
                    LOWORD(v36) = v19 + 1;
                    v22 = v36;
                    sub_5A6C10(-1, -1);
                    v25 = 0;
                  }
                  else
                  {
                    HIWORD(v41) = WORD1(v19);
                    LOWORD(v41) = v19 + 1;
                    v22 = v41;
                    sub_5A6C10(-1, -1);
                  }
                }
              }
              else
              {
                v50[0] = (__int16)v19;
                v50[1] = SWORD1(v19);
                v50[2] = 3;
                v50[3] = 4;
                if ( v20 != 0 )
                {
                  LOWORD(v35) = v19 + 1;
                  HIWORD(v35) = WORD1(v19) - 1;
                  v22 = v35;
                  sub_5A6C10(-1, -1);
                  v20 = 0;
                }
                if ( (unsigned __int8)sub_5A76E0(v50) != 0 )
                {
                  v16 = SHIWORD(v27);
                  if ( SHIWORD(v27) - SWORD1(v19) < 4 )
                    goto LABEL_67;
                  v50[4] = (__int16)v19;
                  v50[5] = SWORD1(v19) + 3;
                  v50[6] = 3;
                  v50[7] = 2;
                  if ( (unsigned __int8)sub_5A7250(0) != 0 && v16 - SWORD1(v19) > 5 )
                  {
                    v20 = 1;
                    v25 = 1;
                  }
                  sub_5A6C10(-1, -1);
                  v50[16] = (__int16)v19 - 1;
                  v50[17] = SWORD1(v19);
                  v50[18] = 1;
                  v50[19] = 3;
                  if ( (unsigned __int8)sub_5A7250(0) != 0 )
                  {
                    HIWORD(v34) = WORD1(v19);
                    LOWORD(v34) = v19 - 1;
                    v22 = v34;
                    sub_5A6C10(-1, -1);
                  }
                  v51[4] = (__int16)v19 + 3;
                  v51[5] = SWORD1(v19);
                  v51[6] = 1;
                  v51[7] = 3;
                  if ( (unsigned __int8)sub_5A7250(0) != 0 )
                  {
                    HIWORD(v33) = WORD1(v19);
                    LOWORD(v33) = v19 + 3;
                    v22 = v33;
                    sub_5A6C10(-1, -1);
                  }
                  WORD1(v19) += 2;
                }
                else
                {
                  v32[0] = v19 - 0x10000;
                  v22 = v19 - 0x10000;
                  sub_5A6C10(-1, -1);
                  LOWORD(v31) = v19 + 1;
                  HIWORD(v31) = WORD1(v19) - 2;
                  v22 = v31;
                  v17 = sub_5657A0(&v22);
                  if ( (unsigned __int8)sub_486730(v17) != 0 && (unsigned __int8)sub_486730(v17) != 0 )
                  {
                    do
                    {
                      *(_DWORD *)(v17 + 56) = dword_ABBEC8 + 1;
                      *(_BYTE *)(v17 + 282) = 1;
                      v17 = sub_481810(0);
                    }
                    while ( (unsigned __int8)sub_486730(v17) != 0 );
                  }
                  v21 = 0;
                }
              }
              goto LABEL_35;
            }
            v49[7] = 2;
            v51[2] = 3;
            v49[6] = 3;
            v49[4] = (__int16)v19;
            v49[5] = (__int16)v5;
            v51[0] = (__int16)v19;
            v51[1] = (__int16)v5 - 3;
            v51[3] = 4;
            if ( SHIWORD(v27) - (__int16)v5 < 2 )
              goto LABEL_69;
            if ( v14 == 0 )
              goto LABEL_37;
            v50[12] = (__int16)v19;
            v50[13] = (__int16)v5 - 3;
            v50[14] = 3;
            v50[15] = 4;
            if ( (unsigned __int8)sub_5A7250(0) == 0 )
              goto LABEL_37;
            do
            {
              v42 = (unsigned int)sub_65C780(&unk_ABE890);
              v15 = sub_7C5F00((double)v42 * 4.656612874161595e-10);
            }
            while ( v15 > 1 );
            if ( v15 != 0 )
            {
              v29 = v19 - 196608;
              v22 = v19 - 196608;
              sub_5A6C10(-1, -1);
            }
            else
            {
LABEL_37:
              if ( (unsigned __int8)sub_5A76E0(v51) != 0 )
              {
                v30 = v19 - 196608;
                v22 = v19 - 196608;
                sub_5A6C10(-1, -1);
                sub_5A6C10(-1, -1);
              }
              else
              {
                if ( (unsigned __int8)sub_5A7250(0) == 0 )
                  goto LABEL_35;
                sub_5A6C10(-1, -1);
              }
            }
            v21 = 1;
LABEL_35:
            v14 = 0;
            LOWORD(v5) = ++WORD1(v19);
            if ( SWORD1(v19) >= SHIWORD(v27) )
            {
              if ( v20 != 0 )
              {
                LOWORD(v28) = v19 + 1;
                HIWORD(v28) = WORD1(v19) - 1;
                v22 = v28;
                sub_5A6C10(-1, -1);
              }
              break;
            }
          }
        }
        v49[0] = (__int16)v19;
        v49[1] = SWORD1(v19);
        v49[2] = 3;
        v49[3] = 4;
        if ( (unsigned __int8)sub_5A7250(0) != 0 )
        {
          do
            v45 = (unsigned int)sub_65C780(&unk_ABE890);
          while ( (unsigned int)sub_7C5F00((double)v45 * 4.656612874161595e-10) > 1 );
        }
LABEL_67:
        LOWORD(v5) = sub_5A6C10(-1, -1);
LABEL_69:
        v13 = v26 - 10;
        v23 += 10;
        v26 -= 10;
      }
      else
      {
        v23 += 2;
        v13 -= 2;
        v26 = v13;
      }
    }
  }
  return v5;
}
